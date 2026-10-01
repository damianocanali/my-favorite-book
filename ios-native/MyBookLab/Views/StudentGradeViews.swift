// Grading with tips, the child's side: their own level (a friendly badge,
// never a score, never anyone else's), the teacher's tips read aloud on
// request, and "sent back — try again". Shown inside the existing
// assignment card and feedback sheet (StudentAssignmentsView.swift).
// Counterpart of the web's StudentFeedbackModal / AssignmentCard grading.
import SwiftUI

/// "🌟 Wow!" — big in the feedback sheet, a small line on the card.
struct StudentLevelBadge: View {
    let level: String
    var compact = false

    var body: some View {
        HStack(spacing: compact ? 6 : 12) {
            Text(verbatim: GradingRules.emoji(level))
                .font(.system(size: compact ? 18 : 44))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                if !compact {
                    Text(GradingCopy.studentLevelHeading)
                        .font(.caption.bold())
                        .foregroundStyle(.white.opacity(0.7))
                }
                Text(GradingCopy.level(level))
                    .font(compact ? .subheadline.weight(.semibold) : .system(.title2, design: .rounded).bold())
                    .foregroundStyle(.white)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// The level and the tips, each tip with its own Read aloud button.
struct StudentGradeCard: View {
    let grade: SubmissionGrade
    let speaker: SpeechSpeaker

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            StudentLevelBadge(level: grade.level)
            let tips = GradeTipText.showable(grade.tips)
            if !tips.isEmpty {
                Text(GradingCopy.studentTipsHeading)
                    .font(.subheadline.bold())
                    .foregroundStyle(.yellow)
                    .accessibilityAddTraits(.isHeader)
                ForEach(tips, id: \.self) { tip in
                    let spoken = GradeTipText.string(tip)
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "lightbulb.fill")
                            .foregroundStyle(.yellow)
                            .padding(.top, 3)
                            .accessibilityHidden(true)
                        GradeTipText.text(tip)
                            .font(.body)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Button { speaker.toggle(spoken) } label: {
                            Image(systemName: speaker.isSpeaking(spoken) ? "stop.fill" : "speaker.wave.2.fill")
                                .frame(width: 44, height: 44)
                                .foregroundStyle(.cyan)
                        }
                        .accessibilityLabel(Text(speaker.isSpeaking(spoken) ? AssignmentCopy.stopReading : GradingCopy.studentListenTip))
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(GradeLevelStyle.tint(grade.level).opacity(0.14), in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(GradeLevelStyle.tint(grade.level).opacity(0.4)))
    }
}

/// "Your teacher sent this back with tips. Try again!" and the button that
/// opens their book to revise and hand in again. Calm: no pulsing.
struct SentBackBanner: View {
    let onTryAgain: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label {
                Text(GradingCopy.studentSentBack)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
            } icon: {
                Image(systemName: "arrow.uturn.backward.circle.fill").foregroundStyle(.orange)
            }
            Button(action: onTryAgain) {
                Label { Text(GradingCopy.studentTryAgain) } icon: { Image(systemName: "pencil.and.scribble") }
                    .font(.subheadline.bold())
                    .padding(.horizontal, 18)
                    .frame(minHeight: 44)
                    .background(.orange.opacity(0.25), in: Capsule())
                    .overlay(Capsule().strokeBorder(.orange.opacity(0.6)))
                    .foregroundStyle(.white)
            }
            .buttonStyle(.plain)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
    }
}
