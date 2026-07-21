import Accelerate
import AVFoundation
import Foundation

struct NativeAudioSample: Sendable {
  let level: Float
  let note: String?
  let frequency: Int
  let cents: Int
  let confidence: Float

  var dictionary: [String: Any] {
    [
      "level": level,
      "note": note ?? NSNull(),
      "frequency": frequency,
      "cents": cents,
      "confidence": confidence,
    ]
  }
}

final class NativeAudioService: @unchecked Sendable {
  private let engine = AVAudioEngine()
  private let analysisQueue = DispatchQueue(label: "com.surstudio.audio-analysis", qos: .userInitiated)
  private var frameCounter = 0
  private(set) var isMonitoring = false

  func requestPermission(_ completion: @escaping @Sendable (Bool) -> Void) {
    switch AVCaptureDevice.authorizationStatus(for: .audio) {
    case .authorized:
      completion(true)
    case .notDetermined:
      AVCaptureDevice.requestAccess(for: .audio, completionHandler: completion)
    default:
      completion(false)
    }
  }

  func start(onSample: @escaping @Sendable (NativeAudioSample) -> Void) throws {
    guard !isMonitoring else { return }
    let input = engine.inputNode
    let format = input.outputFormat(forBus: 0)
    guard format.sampleRate > 0, format.channelCount > 0 else { throw AudioError.inputUnavailable }

    input.installTap(onBus: 0, bufferSize: 2_048, format: format) { [weak self] buffer, _ in
      guard let self, let channel = buffer.floatChannelData?.pointee else { return }
      self.frameCounter += 1
      guard self.frameCounter.isMultiple(of: 3) else { return }
      let samples = Array(UnsafeBufferPointer(start: channel, count: Int(buffer.frameLength)))
      self.analysisQueue.async {
        let result = Self.analyze(samples: samples, sampleRate: Float(format.sampleRate))
        onSample(result)
      }
    }
    engine.prepare()
    try engine.start()
    isMonitoring = true
  }

  func stop() {
    guard isMonitoring else { return }
    engine.inputNode.removeTap(onBus: 0)
    engine.stop()
    isMonitoring = false
  }

  private static func analyze(samples input: [Float], sampleRate: Float) -> NativeAudioSample {
    guard input.count > 128 else { return NativeAudioSample(level: 0, note: nil, frequency: 0, cents: 0, confidence: 0) }
    var samples = input
    var mean: Float = 0
    vDSP_meanv(samples, 1, &mean, vDSP_Length(samples.count))
    var negativeMean = -mean
    vDSP_vsadd(samples, 1, &negativeMean, &samples, 1, vDSP_Length(samples.count))
    var rms: Float = 0
    vDSP_rmsqv(samples, 1, &rms, vDSP_Length(samples.count))
    guard rms > 0.006 else { return NativeAudioSample(level: min(1, rms * 8), note: nil, frequency: 0, cents: 0, confidence: 0) }

    let minLag = max(1, Int(sampleRate / 1_000))
    let maxLag = min(samples.count / 2, Int(sampleRate / 65))
    var bestLag = 0
    var bestCorrelation: Float = 0

    samples.withUnsafeBufferPointer { pointer in
      guard let base = pointer.baseAddress else { return }
      for lag in minLag...maxLag {
        let count = samples.count - lag
        var dot: Float = 0
        var energyA: Float = 0
        var energyB: Float = 0
        vDSP_dotpr(base, 1, base.advanced(by: lag), 1, &dot, vDSP_Length(count))
        vDSP_svesq(base, 1, &energyA, vDSP_Length(count))
        vDSP_svesq(base.advanced(by: lag), 1, &energyB, vDSP_Length(count))
        let correlation = dot / max(0.000_001, sqrt(energyA * energyB))
        if correlation > bestCorrelation {
          bestCorrelation = correlation
          bestLag = lag
        }
      }
    }

    guard bestLag > 0, bestCorrelation > 0.58 else { return NativeAudioSample(level: min(1, rms * 8), note: nil, frequency: 0, cents: 0, confidence: bestCorrelation) }
    let frequency = sampleRate / Float(bestLag)
    let midiValue = 69 + (12 * log2(frequency / 440))
    let midi = Int(midiValue.rounded())
    let names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"]
    let noteIndex = ((midi % 12) + 12) % 12
    let note = "\(names[noteIndex])\((midi / 12) - 1)"
    let cents = Int(((midiValue - Float(midi)) * 100).rounded())
    return NativeAudioSample(level: min(1, rms * 8), note: note, frequency: Int(frequency.rounded()), cents: cents, confidence: bestCorrelation)
  }

  enum AudioError: LocalizedError {
    case inputUnavailable
    var errorDescription: String? { "No microphone input is available." }
  }
}
