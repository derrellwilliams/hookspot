import SwiftUI

/// LoginPage: email → 6-digit code. Doubles as sign-up. iOS fills the code from Mail.
struct LoginView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var email = ""
    @State private var code = ""
    @State private var sent = false
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focused: Field?

    enum Field { case email, code }

    var body: some View {
        ZStack {
            DitherBackground()
            VStack(spacing: 28) {
                Text("HookSpot").font(Typography.wordmark).foregroundStyle(.white)
                    .accessibilityAddTraits(.isHeader)
                VStack(spacing: 14) {
                    if !sent { emailStep } else { codeStep }
                    if let error {
                        Text(error).font(Typography.caption).foregroundStyle(.red.opacity(0.9))
                            .multilineTextAlignment(.center)
                    }
                }
                .glassCard()
                .frame(maxWidth: 420)
                .motion(Motion.springSmooth, value: sent)
            }
            .padding(24)
        }
        .overlay(alignment: .topTrailing) {
            Button { dismiss() } label: {
                Icon.xmark.view(18).frame(width: 44, height: 44)
            }
            .buttonStyle(.glass)
            .buttonBorderShape(.circle)
            .padding()
            .accessibilityLabel("Close")
        }
        .onAppear { focused = .email }
        .onChange(of: auth.isSignedIn) { _, signedIn in if signedIn { dismiss() } }
    }

    private var emailStep: some View {
        VStack(spacing: 14) {
            TextField("your@email.com", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.continue)
                .focused($focused, equals: .email)
                .onSubmit(sendCode)
                .fieldChrome()
            Button("Continue", action: sendCode)
                .buttonStyle(PrimaryButtonStyle(isBusy: busy))
                .disabled(busy || !email.contains("@"))
        }
        .transition(reduceMotion ? .opacity : .push(from: .leading))
    }

    private var codeStep: some View {
        VStack(spacing: 14) {
            Text("Check your email for a 6-digit code.").font(Typography.caption).foregroundStyle(Theme.darkMuted)
            TextField("123456", text: $code)
                .textContentType(.oneTimeCode)
                .keyboardType(.numberPad)
                .font(Typography.font(.mono, 22, .medium, relativeTo: .title3))
                .multilineTextAlignment(.center)
                .focused($focused, equals: .code)
                .onChange(of: code) { _, new in
                    let digits = String(new.filter(\.isNumber).prefix(6))
                    if digits != new { code = digits }
                    if digits.count == 6 { verify() }
                }
                .fieldChrome()
            Button("Sign in", action: verify)
                .buttonStyle(PrimaryButtonStyle(isBusy: busy))
                .disabled(busy || code.count < 6)
            Button("Use a different email") {
                sent = false; code = ""; error = nil; focused = .email
            }
            .font(Typography.caption)
            .foregroundStyle(Theme.darkMuted)
            .frame(minHeight: 44)
        }
        .transition(reduceMotion ? .opacity : .push(from: .trailing))
    }

    private func sendCode() {
        guard !busy, email.contains("@") else { return }
        busy = true; error = nil
        Task {
            defer { busy = false }
            do {
                try await auth.sendCode(email: email)
                sent = true
                focused = .code
            } catch { self.error = error.localizedDescription }
        }
    }

    private func verify() {
        guard !busy, code.count == 6 else { return }
        busy = true; error = nil
        Task {
            defer { busy = false }
            do { try await auth.verify(email: email, code: code) } // auth state change dismisses
            catch { self.error = error.localizedDescription }
        }
    }
}
