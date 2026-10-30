import SwiftUI

/// SelectWithCustom: pick a past rod/fly from a menu or type a new one.
struct GearField: View {
    let title: String
    @Binding var value: String
    let suggestions: [String]

    var body: some View {
        HStack {
            TextField(title, text: $value)
                .textInputAutocapitalization(.words)
            if !suggestions.isEmpty {
                Menu {
                    ForEach(suggestions, id: \.self) { s in
                        Button(s) { value = s }
                    }
                    if !value.isEmpty {
                        Divider()
                        Button("Clear", role: .destructive) { value = "" }
                    }
                } label: {
                    Icon.chevronsUpDown.view(16)
                        .frame(width: 44, height: 44)
                        .contentShape(.rect)
                }
                .accessibilityLabel("Choose a saved \(title.lowercased())")
            }
        }
    }
}

extension FeedStore {
    /// Past rods/flies from your own catches (prevRods/prevFlys) plus your saved gear lists.
    func gearSuggestions(_ key: String, saved: [String]) -> [String] {
        var seen = Set<String>()
        return (saved + photos.filter(\.isOwn).compactMap { Formatters.cleanGear($0.meta[key]?.stringValue) })
            .filter { seen.insert($0).inserted }
    }
}
