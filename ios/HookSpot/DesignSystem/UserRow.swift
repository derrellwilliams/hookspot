import SwiftUI

/// UserRow.jsx: avatar + display name + @username. Used by follow lists and search.
struct UserRow: View {
    let profile: ProfileSummary

    var body: some View {
        HStack(spacing: 12) {
            Avatar(profile: profile, size: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(Formatters.displayName(profile)).font(Typography.headline).foregroundStyle(Theme.darkText)
                    .lineLimit(1)
                if let u = profile.username {
                    Text("@\(u)").font(Typography.cardMeta).foregroundStyle(Theme.darkMuted).lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
        .frame(minHeight: 44)
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
    }
}
