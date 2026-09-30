// What "I need a grown-up" shows a class account. Mirrors the web's
// src/components/school/TeacherHelpScreen.jsx.
//
// CheckInHost owns the one help request (through SchoolShare) and passes its
// state in; this view never posts an ask itself, only polls whether the
// teacher has seen it.
//
//   pending            the instant the child answers, before the ask has
//                      come back — on slow wifi that can take a noticeable
//                      moment (8 s at most), and a child who just said they
//                      need a grown-up must never be left looking at nothing.
//   sent, !ok          the ask failed (including a timeout). The one sharing
//                      failure a child DOES see: staying quiet would leave
//                      them believing help is coming when it isn't.
//   sent, !inHours     outside school hours: nobody is there to see it, so no
//                      polling either.
//   sent, inHours      polls every 20 s while this is open until the teacher
//                      has seen it, then stops for good.

import SwiftUI

struct TeacherHelpView: View {
    enum Phase: Equatable {
        case pending
        case sent(SchoolShare.HelpResult)
    }

    let phase: Phase

    @Environment(\.dismiss) private var dismiss
    @State private var seen = false
    @State private var teacherName: String?

    private static let pollInterval: Duration = .seconds(20)

    private var result: SchoolShare.HelpResult? {
        if case .sent(let r) = phase { return r }
        return nil
    }

    /// The ask's id when polling makes sense, else nil. Also the `.task` id,
    /// so polling starts the moment a pending ask resolves in hours.
    private var pollID: String? {
        guard let result, result.ok, result.inHours, let id = result.id else { return nil }
        return id
    }

    private var message: LocalizedStringResource {
        guard let result else { return "Sending your message…" }
        if !result.ok { return "Tell a grown-up near you that you need help." }
        if !result.inHours {
            return "Your teacher will see this at school. If you need help now, tell a grown-up near you."
        }
        if seen {
            if let teacherName { return "\(teacherName) saw your message" }
            return "Your teacher saw your message"
        }
        return "Your teacher got your message."
    }

    var body: some View {
        ZStack {
            CosmicBackground()
            VStack(spacing: 16) {
                Mascot(mood: .welcome, size: 96)
                // The heart is decoration: kept out of the spoken label so
                // VoiceOver reads the sentence once, cleanly.
                (Text(message) + Text(verbatim: seen ? " 💛" : ""))
                    .font(.system(.title3, design: .rounded).bold())
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel(Text(message))
                SparkleButton(action: { dismiss() }) { Text("Close") }
                    .padding(.top, 8)
            }
            .padding(28)
            .frame(maxWidth: ContentWidth.form)
        }
        // Text changing under VoiceOver is silent unless announced.
        .onChange(of: String(appLocalized: message)) { _, spoken in
            AccessibilityNotification.Announcement(spoken).post()
        }
        // Cancelled when the view goes away, which is what stops polling on
        // close. Keyed on the id so a pending ask that resolves in hours
        // starts polling without a reopen.
        .task(id: pollID) {
            guard let id = pollID else { return }
            while !seen, !Task.isCancelled {
                try? await Task.sleep(for: Self.pollInterval)
                if Task.isCancelled { return }
                let status = await SchoolShare.helpSeen(id: id)
                if status.seen {
                    teacherName = status.teacherName
                    seen = true
                }
            }
        }
    }
}
