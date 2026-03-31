import Foundation
import Observation

final class APIClient {
    var tokenProvider: () -> String? = { nil }
    private unowned let settings: AppSettingsStore
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    private let session: URLSession

    init(settings: AppSettingsStore, session: URLSession = .shared) {
        self.settings = settings
        self.session = session
        encoder = JSONEncoder()
        decoder = JSONDecoder()
    }

    private var baseURL: URL {
        guard let url = URL(string: settings.serverBaseURL.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            return URL(string: "http://154.83.158.137:3003")!
        }
        return url
    }

    private func makeRequest(path: String, method: String, body: Data? = nil) throws -> URLRequest {
        let url = baseURL.appending(path: path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.timeoutInterval = 60
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(settings.language.rawValue, forHTTPHeaderField: "x-locale")
        request.setValue(settings.effectiveTimeZoneIdentifier, forHTTPHeaderField: "x-timezone")
        if let token = tokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    func send<Response: Decodable>(
        path: String,
        method: String = "GET",
        body: Encodable? = nil
    ) async throws -> Response {
        let data = try await rawRequest(path: path, method: method, body: body)
        return try decoder.decode(APIEnvelope<Response>.self, from: data).data
    }

    func rawRequest(
        path: String,
        method: String = "GET",
        body: Encodable? = nil
    ) async throws -> Data {
        let bodyData = try body.map { try encoder.encode(AnyEncodable($0)) }
        let urlRequest = try makeRequest(path: path, method: method, body: bodyData)
        let (data, response) = try await session.data(for: urlRequest)
        try validate(response: response, data: data)
        return data
    }

    func streamText(path: String, body: Encodable) -> AsyncThrowingStream<String, Error> {
        let urlRequest: URLRequest
        do {
            let bodyData = try encoder.encode(AnyEncodable(body))
            urlRequest = try makeRequest(path: path, method: "POST", body: bodyData)
        } catch {
            return AsyncThrowingStream { continuation in
                continuation.finish(throwing: error)
            }
        }
        let session = self.session

        return AsyncThrowingStream { continuation in
            Task {
                do {
                    let (bytes, response) = try await session.bytes(for: urlRequest)
                    guard let httpResponse = response as? HTTPURLResponse else {
                        throw APIErrorPayload(code: "invalid_response", message: "Invalid response")
                    }
                    guard (200..<300).contains(httpResponse.statusCode) else {
                        throw APIErrorPayload(
                            code: "http_\(httpResponse.statusCode)",
                            message: HTTPURLResponse.localizedString(forStatusCode: httpResponse.statusCode)
                        )
                    }

                    var iterator = bytes.makeAsyncIterator()
                    var buffer = Data()
                    while let byte = try await iterator.next() {
                        buffer.append(byte)
                        if buffer.count >= 128, let chunk = String(data: buffer, encoding: .utf8) {
                            continuation.yield(chunk)
                            buffer.removeAll(keepingCapacity: true)
                        }
                    }

                    if !buffer.isEmpty, let finalChunk = String(data: buffer, encoding: .utf8) {
                        continuation.yield(finalChunk)
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    func streamEvents(path: String, body: Encodable) -> AsyncThrowingStream<AIStreamEvent, Error> {
        let urlRequest: URLRequest
        do {
            let bodyData = try encoder.encode(AnyEncodable(body))
            urlRequest = try makeRequest(path: path, method: "POST", body: bodyData)
        } catch {
            return AsyncThrowingStream { continuation in
                continuation.finish(throwing: error)
            }
        }
        let session = self.session

        return AsyncThrowingStream { continuation in
            Task {
                do {
                    let (bytes, response) = try await session.bytes(for: urlRequest)
                    guard let httpResponse = response as? HTTPURLResponse else {
                        throw APIErrorPayload(code: "invalid_response", message: "Invalid response")
                    }
                    guard (200..<300).contains(httpResponse.statusCode) else {
                        throw APIErrorPayload(
                            code: "http_\(httpResponse.statusCode)",
                            message: HTTPURLResponse.localizedString(forStatusCode: httpResponse.statusCode)
                        )
                    }

                    var iterator = bytes.makeAsyncIterator()
                    var buffer = ""
                    while let byte = try await iterator.next() {
                        if let scalar = UnicodeScalar(byte) {
                            buffer.unicodeScalars.append(scalar)
                        }
                        while let newlineIndex = buffer.firstIndex(of: "\n") {
                            let line = String(buffer[..<newlineIndex]).trimmingCharacters(in: .whitespacesAndNewlines)
                            buffer = String(buffer[buffer.index(after: newlineIndex)...])
                            guard !line.isEmpty else { continue }
                            let data = Data(line.utf8)
                            let event = try self.decoder.decode(AIStreamEvent.self, from: data)
                            continuation.yield(event)
                        }
                    }

                    if !buffer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        let event = try self.decoder.decode(AIStreamEvent.self, from: Data(buffer.utf8))
                        continuation.yield(event)
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(httpResponse.statusCode) else {
            if let envelope = try? decoder.decode(APIErrorEnvelope.self, from: data) {
                throw envelope.error
            }
            throw APIErrorPayload(code: "http_\(httpResponse.statusCode)", message: HTTPURLResponse.localizedString(forStatusCode: httpResponse.statusCode))
        }
    }
}

private struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void

    init<T: Encodable>(_ wrapped: T) {
        encodeClosure = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try encodeClosure(encoder)
    }
}
