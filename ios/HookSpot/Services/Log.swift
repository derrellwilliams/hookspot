import os

/// One `Logger` per area. Failures the UI recovers from silently still land here, so a
/// device log shows why (filter by subsystem `com.hookspot.app` in Console).
/// Interpolated values are private by default; only mark non-personal ones `.public`.
nonisolated enum Log {
    static let feed = Logger(subsystem: "com.hookspot.app", category: "feed")
    static let upload = Logger(subsystem: "com.hookspot.app", category: "upload")
    static let catches = Logger(subsystem: "com.hookspot.app", category: "catches")
    static let auth = Logger(subsystem: "com.hookspot.app", category: "auth")
}
