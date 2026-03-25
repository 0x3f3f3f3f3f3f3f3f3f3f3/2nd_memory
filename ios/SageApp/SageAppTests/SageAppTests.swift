import XCTest
@testable import SageApp

final class SageAppTests: XCTestCase {
    override func tearDown() {
        MockURLProtocol.handler = nil
        super.tearDown()
    }

    func testKeychainWriteReadDeleteRoundTrip() throws {
        let store = KeychainStore(service: "com.sage.tests")
        let key = "token-\(UUID().uuidString)"
        let value = "secret-token"

        try store.write(value, for: key)
        XCTAssertEqual(store.read(key), value)

        store.delete(key)
        XCTAssertNil(store.read(key))
    }

    func testAPIClientDecodesEnvelopeAndThrowsStructuredError() async throws {
        let settings = AppSettingsStore(defaults: UserDefaults(suiteName: "APIClientTests")!)
        settings.setServerBaseURL("https://example.com")
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockURLProtocol.self]
        let session = URLSession(configuration: configuration)
        let client = APIClient(settings: settings, session: session)

        MockURLProtocol.handler = { request in
            if request.url?.path == "/success" {
                return (
                    HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!,
                    #"{"data":{"success":true}}"#.data(using: .utf8)!
                )
            }

            return (
                HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!,
                #"{"error":{"code":"unauthorized","message":"Nope"}}"#.data(using: .utf8)!
            )
        }

        let success: EmptySuccessDTO = try await client.send(path: "/success")
        XCTAssertTrue(success.success)

        do {
            let _: EmptySuccessDTO = try await client.send(path: "/failure")
            XCTFail("Expected structured error")
        } catch let error as APIErrorPayload {
            XCTAssertEqual(error.code, "unauthorized")
            XCTAssertEqual(error.message, "Nope")
        }
    }

    func testInboxViewModelLoadHappyPath() async throws {
        let settings = AppSettingsStore(defaults: UserDefaults(suiteName: "InboxViewModelTests")!)
        settings.setServerBaseURL("https://example.com")
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockURLProtocol.self]
        let session = URLSession(configuration: configuration)
        let client = APIClient(settings: settings, session: session)

        MockURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.path, "/api/mobile/v1/inbox")
            return (
                HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!,
                #"{"data":[{"id":"inbox-1","content":"Capture this","capturedAt":"2026-03-25T12:00:00Z","processedAt":null,"processType":"NONE"}]}"#.data(using: .utf8)!
            )
        }

        let model = InboxViewModel()
        await model.load(using: client)

        XCTAssertEqual(model.items.count, 1)
        XCTAssertEqual(model.items.first?.content, "Capture this")
        XCTAssertNil(model.errorMessage)
    }
}

private final class MockURLProtocol: URLProtocol {
    nonisolated(unsafe) static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = MockURLProtocol.handler else {
            return
        }

        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}
