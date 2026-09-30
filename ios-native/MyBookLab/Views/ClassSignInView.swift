// Children's class sign-in: class code → "which one is you?" → three
// pictures. Native counterpart of src/pages/ClassSignInPage.jsx (with
// NameTiles + PicturePad); same endpoints, same error copy, same rules:
//
// - No email, no password, no reading required past the code. The name
//   tiles lead with the child's emoji, the pad is all pictures.
// - Nothing is remembered implicitly: not the code, not a name, not a
//   picture. A class iPad is something a teacher sets up on purpose
//   (ClassDeviceStore); then this screen opens straight on that class's
//   name list (`.device`) and the child never types the code. Otherwise it
//   starts at the code step every time (`.open`).
// - Children never see an attempt counter, a price, or why a class is
//   closed. Every server code collapses to one of seven gentle sentences.
//
// Part of the full-screen sign-in flow (SignInFlowView): on iPad this is a
// child's whole screen, not a form sheet, so the tiles and pictures can be
// big, and nothing is dismissed by a stray tap.
import SwiftUI

struct ClassSignInView: View {
    enum Mode {
        /// "I'm a student" from the welcome screen: type the class code.
        case open
        /// A class iPad: straight to this class's name list.
        case device(ClassDevice)
    }

    let mode: Mode
    /// `.open`: Back from the code step (to the welcome screen).
    /// `.device`: "Not in <class>?" (to the welcome screen; the iPad stays
    /// set up).
    var onExit: () -> Void

    @Environment(AuthStore.self) private var auth
    @Environment(\.horizontalSizeClass) private var hSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    enum Step { case code, name, pictures }

    @State private var step: Step = .code
    @State private var code = ""
    @State private var classroom: APIClient.SchoolRoster.Classroom?
    @State private var students: [APIClient.SchoolRoster.Student] = []
    @State private var selected: APIClient.SchoolRoster.Student?
    @State private var picks: [String] = []
    @State private var errorCode: String?
    @State private var checkingCode = false
    @State private var submitting = false
    @State private var shaking = false
    @State private var shakeTrigger: CGFloat = 0
    @State private var speaker = SpeechSpeaker()
    @FocusState private var codeFocused: Bool
    /// `.device` only: loading the class's name list.
    @State private var loadingDevice = false
    /// `.device` only: the stored class code stopped working (or the
    /// network did). The error code, as the server sent it.
    @State private var deviceError: String?
    @State private var confirmingExit = false
    /// How long the wrong-guess shake plays before the slots clear — same as
    /// the web's SHAKE_MS.
    private static let shakeDuration: Duration = .milliseconds(450)

    private var regular: Bool { hSize == .regular }

    var body: some View {
        ZStack {
            CosmicBackground().ignoresSafeArea()
            VStack(spacing: 0) {
            // Back first in reading order (a top bar, not an overlay).
            SignInTopBar(onBack: showsBack ? back : nil)
            ScrollView {
                VStack(spacing: regular ? 24 : 18) {
                    header
                    card
                    if let device {
                        Button {
                            speaker.stop()
                            onExit()
                        } label: {
                            Text(SignInCopy.notInClass(device.displayName))
                                .font(.callout)
                                .foregroundStyle(.white.opacity(0.8))
                                .underline()
                                .frame(minHeight: 48)
                        }
                    }
                }
                .padding(.vertical, regular ? 32 : 16)
                // The picture pad on a phone needs every point of width to keep
                // four 96pt targets per row, so only the iPad gets side gutters.
                .padding(.horizontal, regular ? 32 : 0)
                .contentColumn(maxWidth: step == .code ? 560 : step == .name ? 760 : 640)
            }
            .scrollDismissesKeyboard(.interactively)
            }
        }
        // VoiceOver hears an error the moment it appears.
        .onChange(of: errorCode) { _, code in
            if let code { AccessibilityNotification.Announcement(String(appLocalized: SchoolCopy.error(code))).post() }
        }
        .onChange(of: deviceError) { _, code in
            if code != nil { AccessibilityNotification.Announcement(String(appLocalized: deviceMessage)).post() }
        }
        .discardTypedConfirmation(isPresented: $confirmingExit) {
            speaker.stop()
            onExit()
        }
        .task {
            guard let device, step == .code, students.isEmpty else { return }
            code = device.code
            await loadDevice()
        }
        .onDisappear { speaker.stop() }
    }

    private var device: ClassDevice? {
        if case .device(let d) = mode { return d }
        return nil
    }

    // MARK: - Back

    /// Pictures → names in both modes; names → code, and code → out, only
    /// when the child came in by typing a code. On a class iPad the name
    /// list is home, and "Not in <class>?" is the way out.
    private var showsBack: Bool {
        switch step {
        case .pictures: true
        case .name, .code: device == nil
        }
    }

    private func back() {
        Haptics.tap()
        switch step {
        case .pictures:
            guard !submitting else { return }
            selected = nil
            picks = []
            errorCode = nil
            step = .name
        case .name:
            notMyClass()
        case .code:
            // Only a half-typed code is worth asking about.
            if code.isEmpty { speaker.stop(); onExit() } else { confirmingExit = true }
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 8) {
            if let device {
                // The class banner: which class this iPad belongs to, before
                // anything else. A class name is data, never translated.
                Text(SignInCopy.classBanner(device.displayName))
                    .font(.system(regular ? .title2 : .title3, design: .rounded, weight: .heavy))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 22)
                    .padding(.vertical, 10)
                    .background(
                        LinearGradient(colors: [Color(red: 0.55, green: 0.3, blue: 0.95),
                                                Color(red: 0.93, green: 0.3, blue: 0.6)],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule())
                    .accessibilityAddTraits(.isHeader)
                    .padding(.bottom, 4)
            }
            Mascot(mood: step == .pictures ? .think : .wave, size: regular ? 110 : 96)
            Text(SchoolCopy.pageTitle)
                .font(.system(regular ? .largeTitle : .title, design: .rounded, weight: .bold))
                .foregroundStyle(.white)
            if device == nil, let name = classroom?.name, step != .code {
                // A class name is data, never translated.
                Text(verbatim: name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.cyan)
                    .textCase(.uppercase)
            }
        }
        .padding(.top, 8)
    }

    // MARK: - Card

    private var card: some View {
        VStack(alignment: .leading, spacing: regular ? 20 : 16) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(heading)
                        .font(.system(regular ? .title2 : .title3, design: .rounded, weight: .bold))
                        .foregroundStyle(.white)
                        .accessibilityAddTraits(.isHeader)
                    if step == .code, device == nil {
                        Text(SchoolCopy.codeHint)
                            .font(.callout)
                            .foregroundStyle(.white.opacity(0.75))
                    }
                }
                Spacer(minLength: 0)
                listenButton
            }
            .padding(.horizontal, regular ? 0 : 16)

            if let errorCode {
                Text(SchoolCopy.error(errorCode))
                    .font(.callout)
                    .foregroundStyle(Color(red: 1, green: 0.8, blue: 0.8))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                    .background(.red.opacity(0.15), in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(.red.opacity(0.3)))
                    .padding(.horizontal, regular ? 0 : 16)
                    .accessibilityAddTraits(.updatesFrequently)
            }

            switch step {
            case .code:
                if device != nil {
                    deviceStatus.padding(.horizontal, regular ? 0 : 16)
                } else {
                    codeStep.padding(.horizontal, regular ? 0 : 16)
                }
            case .name: nameStep
            case .pictures: pictureStep
            }
        }
        .padding(.vertical, regular ? 28 : 20)
        .padding(.horizontal, regular ? 28 : 0)
        // A glass card on iPad; on a phone the steps sit straight on the
        // background, because the pad runs edge to edge.
        .background(.white.opacity(regular ? 0.07 : 0), in: RoundedRectangle(cornerRadius: 28))
        .overlay(RoundedRectangle(cornerRadius: 28).strokeBorder(.white.opacity(regular ? 0.1 : 0)))
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: errorCode)
    }

    private var heading: LocalizedStringResource {
        switch step {
        case .code where device != nil:
            // Neutral: the sentence below says what's wrong, once.
            deviceError == nil ? SchoolCopy.codeChecking : SignInCopy.deviceProblemHeading
        case .code: SchoolCopy.codeHeading
        case .name: SchoolCopy.nameHeading
        case .pictures: SchoolCopy.pictureHeading
        }
    }

    private var listenButton: some View {
        Button {
            speaker.speak(speechText)
        } label: {
            Image(systemName: "speaker.wave.2.fill")
                .font(.title2)
                .foregroundStyle(.cyan)
                .frame(width: regular ? 64 : 56, height: regular ? 64 : 56)
                .background(.white.opacity(0.1), in: RoundedRectangle(cornerRadius: 16))
        }
        .accessibilityLabel(Text(SchoolCopy.listen))
    }

    /// The step's instruction, plus the error if one is showing — the same
    /// sentences the child sees, in the app's language.
    private var speechText: String {
        var parts: [String] = []
        switch step {
        case .code where device != nil:
            parts.append(String(appLocalized: heading))
            if deviceError != nil { parts.append(String(appLocalized: deviceMessage)) }
        case .code:
            parts.append(String(appLocalized: SchoolCopy.codeHeading))
            parts.append(String(appLocalized: SchoolCopy.codeHint))
        case .name: parts.append(String(appLocalized: SchoolCopy.nameHeading))
        case .pictures: parts.append(String(appLocalized: SchoolCopy.pictureHeading))
        }
        if let errorCode { parts.append(String(appLocalized: SchoolCopy.error(errorCode))) }
        return parts.joined(separator: ". ")
    }

    // MARK: - Step 1: class code

    private var codeStep: some View {
        VStack(spacing: 12) {
            TextField("", text: Binding(get: { code }, set: handleCodeChange),
                      prompt: Text(verbatim: "ABC234").foregroundStyle(.white.opacity(0.25)))
                .font(.system(size: regular ? 48 : 38, weight: .bold, design: .monospaced))
                .tracking(regular ? 10 : 6)
                .multilineTextAlignment(.center)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .keyboardType(.asciiCapable)
                .textContentType(.oneTimeCode)
                .foregroundStyle(.white)
                .frame(minHeight: regular ? 96 : 80)
                .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18)
                    .strokeBorder(codeFocused ? Color.purple : .white.opacity(0.18), lineWidth: 2))
                .focused($codeFocused)
                .disabled(checkingCode)
                .accessibilityLabel(Text(SchoolCopy.codeAccessibility))
            if checkingCode {
                HStack(spacing: 8) {
                    ProgressView().tint(.white)
                    Text(SchoolCopy.codeChecking)
                        .font(.callout)
                        .foregroundStyle(.white.opacity(0.75))
                }
            }
        }
        .onAppear { if code.isEmpty { codeFocused = true } }
    }

    private func handleCodeChange(_ raw: String) {
        let next = String(raw.uppercased().filter { $0.isASCII && ($0.isLetter || $0.isNumber) }.prefix(6))
        code = next
        if errorCode != nil { errorCode = nil }
        if next.count == 6 && !checkingCode {
            Task { await attemptCode(next) }
        }
    }

    private func attemptCode(_ value: String) async {
        checkingCode = true
        errorCode = nil
        defer { checkingCode = false }
        do {
            let roster = try await APIClient.shared.schoolRoster(code: value)
            classroom = roster.classroom
            students = roster.students
            codeFocused = false
            step = .name
        } catch let e as APIClient.SchoolError {
            errorCode = e.code ?? "generic"
        } catch {
            errorCode = "generic"
        }
    }

    // MARK: - Class iPad: straight to the names

    /// The iPad's class, loaded from its stored code. If the code stops
    /// working (class archived, code changed, sign-in closed, licence
    /// resting) this says so kindly and stays put: only a teacher removes
    /// the class from the iPad, never a failed request.
    private func loadDevice() async {
        guard let device else { return }
        loadingDevice = true
        deviceError = nil
        errorCode = nil
        defer { loadingDevice = false }
        do {
            let roster = try await APIClient.shared.schoolRoster(code: device.code)
            classroom = roster.classroom
            students = roster.students
            selected = nil
            picks = []
            step = .name
        } catch {
            // No code at all means the request never got an answer.
            deviceError = (error as? APIClient.SchoolError)?.code ?? "network"
            step = .code
        }
    }

    /// Codes that mean "this class can't be signed into from here right
    /// now" (roster.js 404 / 423) rather than a network hiccup.
    private static let unavailableCodes: Set<String> = [
        "class_not_found", "class_resting", "sign_in_closed", "class_paused",
    ]

    /// Codes that mean the server or the connection, not the class.
    private static let networkCodes: Set<String> = ["network", "upstream", "not_configured"]

    private var deviceMessage: LocalizedStringResource {
        guard let deviceError else { return SchoolCopy.codeChecking }
        if Self.unavailableCodes.contains(deviceError) { return SignInCopy.deviceClassUnavailable }
        if Self.networkCodes.contains(deviceError) { return SignInCopy.deviceNetwork }
        return SchoolCopy.error(deviceError)
    }

    private var deviceStatus: some View {
        VStack(spacing: 14) {
            if loadingDevice || deviceError == nil {
                ProgressView().tint(.white).controlSize(.large)
                    .frame(maxWidth: .infinity, minHeight: 96)
            } else if deviceError != nil {
                Text(deviceMessage)
                    .font(.system(.title3, design: .rounded, weight: .semibold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(18)
                    .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
                Button {
                    Task { await loadDevice() }
                } label: {
                    Text(SignInCopy.tryAgain)
                        .font(.headline)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .background(.purple.opacity(0.6), in: Capsule())
                }
            }
        }
    }

    // MARK: - Step 2: name tiles

    private var sortedStudents: [APIClient.SchoolRoster.Student] {
        students.sorted {
            $0.display_name.localizedStandardCompare($1.display_name) == .orderedAscending
        }
    }

    private var nameStep: some View {
        let tile: CGFloat = regular ? 150 : 104
        return VStack(spacing: 16) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: tile), spacing: 12)], spacing: 12) {
                ForEach(sortedStudents) { student in
                    Button {
                        Haptics.tap()
                        selected = student
                        picks = []
                        errorCode = nil
                        step = .pictures
                    } label: {
                        VStack(spacing: 6) {
                            Text(verbatim: student.avatar_emoji ?? "🙂")
                                .font(.system(size: regular ? 60 : 44))
                            Text(verbatim: student.display_name)
                                .font(.system(regular ? .title3 : .headline, design: .rounded, weight: .semibold))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, minHeight: regular ? 150 : 110)
                        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 22))
                        .overlay(RoundedRectangle(cornerRadius: 22).strokeBorder(.white.opacity(0.12)))
                        .contentShape(RoundedRectangle(cornerRadius: 22))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(Text(verbatim: student.display_name))
                }
            }
            .padding(.horizontal, regular ? 0 : 16)

            // On a class iPad "Not in <class>?" (below the card) is the way
            // out instead.
            if device == nil {
                Button(action: notMyClass) {
                    Text(SchoolCopy.notMyClass)
                        .font(.callout)
                        .foregroundStyle(.white.opacity(0.75))
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
            }
        }
    }

    private func notMyClass() {
        code = ""
        classroom = nil
        students = []
        selected = nil
        picks = []
        errorCode = nil
        step = .code
        codeFocused = true
    }

    // MARK: - Step 3: picture pad

    /// 'wrong_pictures' is retry-in-place; every other sign-in error is a
    /// dead end until something outside the child's control changes, so the
    /// pad is replaced by "Start over" rather than left to fail again.
    private var blockingError: Bool {
        step == .pictures && errorCode != nil && errorCode != "wrong_pictures"
    }

    private var pictureStep: some View {
        VStack(spacing: regular ? 20 : 16) {
            if blockingError {
                Button(action: startOver) {
                    Text(SchoolCopy.startOver)
                        .font(.headline)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .background(.purple.opacity(0.6), in: Capsule())
                }
                .padding(.horizontal, regular ? 0 : 16)
            } else {
                slots
                backOneButton
                pad
                if submitting {
                    HStack(spacing: 8) {
                        ProgressView().tint(.white)
                        Text(SchoolCopy.pictureChecking)
                            .font(.callout)
                            .foregroundStyle(.white.opacity(0.75))
                    }
                }
            }
        }
    }

    /// After a dead-end sign-in error: a typed-code child starts again from
    /// the code; a class iPad reloads its own class (which then says so if
    /// the class has become unavailable).
    private func startOver() {
        if device != nil {
            Task { await loadDevice() }
        } else {
            notMyClass()
        }
    }

    private var slots: some View {
        let size: CGFloat = regular ? 104 : 80
        return HStack(spacing: 14) {
            ForEach(0..<3, id: \.self) { i in
                let picture = i < picks.count ? SchoolPicture.byId(picks[i]) : nil
                RoundedRectangle(cornerRadius: 20)
                    .fill(picture == nil ? Color.clear : Color.purple.opacity(0.25))
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .strokeBorder(
                                picture == nil ? Color.white.opacity(0.3) : Color.purple,
                                style: StrokeStyle(lineWidth: 2.5, dash: picture == nil ? [7, 6] : [])
                            )
                    )
                    .overlay(Text(verbatim: picture?.emoji ?? "").font(.system(size: size * 0.5)))
                    .frame(width: size, height: size)
            }
        }
        .modifier(ShakeEffect(travel: shakeTrigger))
        .frame(maxWidth: .infinity)
        .accessibilityHidden(true)
    }

    private var backOneButton: some View {
        Button {
            guard !submitting, !shaking else { return }
            _ = picks.popLast()
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "arrow.uturn.backward")
                Text(SchoolCopy.backOne)
            }
            .font(.callout.weight(.semibold))
            .foregroundStyle(.white.opacity(0.85))
            .padding(.horizontal, 18)
            .frame(minHeight: 48)
            .overlay(Capsule().strokeBorder(.white.opacity(0.25)))
        }
        .disabled(submitting || shaking || picks.isEmpty)
        .opacity(submitting || shaking || picks.isEmpty ? 0.4 : 1)
        .accessibilityLabel(Text(SchoolCopy.backOneAccessibility))
    }

    /// 4 × 4. On a phone the cells touch edge to edge with the tile drawn
    /// inset inside each one, so the whole cell is the tap target: a 390pt
    /// screen gives ~97pt per target, where 12pt gaps would have dropped
    /// them below 96. A 375pt iPhone SE cannot fit four 96pt cells at all,
    /// so the phone grid is adaptive with a 96pt floor — four columns where
    /// they fit, three (125pt targets, tiles capped at 104pt) where they
    /// don't. The iPad has room for real gaps and bigger tiles.
    private var pad: some View {
        let spacing: CGFloat = regular ? 16 : 0
        let columns = regular
            ? Array(repeating: GridItem(.flexible(minimum: 110), spacing: spacing), count: 4)
            : [GridItem(.adaptive(minimum: 96), spacing: 0)]
        let disabled = submitting || shaking
        return LazyVGrid(columns: columns, spacing: spacing) {
            ForEach(SchoolPicture.all) { picture in
                Button {
                    pick(picture.id)
                } label: {
                    RoundedRectangle(cornerRadius: regular ? 24 : 20)
                        .fill(.white.opacity(0.08))
                        .overlay(
                            RoundedRectangle(cornerRadius: regular ? 24 : 20)
                                .strokeBorder(.white.opacity(0.12))
                        )
                        .overlay(Text(verbatim: picture.emoji).font(.system(size: regular ? 54 : 44)))
                        .padding(regular ? 0 : 4)
                        .aspectRatio(1, contentMode: .fit)
                        // Capped so all 16 fit on a portrait iPad without scrolling.
                        .frame(maxWidth: regular ? 120 : 104)
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 96)
                        .contentShape(Rectangle())
                }
                .buttonStyle(PadButtonStyle(reduceMotion: reduceMotion))
                .disabled(disabled)
                .opacity(disabled ? 0.45 : 1)
                .accessibilityLabel(Text(picture.name))
            }
        }
    }

    private func pick(_ id: String) {
        guard !submitting, !shaking, !blockingError, picks.count < 3, let student = selected else { return }
        Haptics.tap()
        picks.append(id)
        if picks.count == 3 {
            let pictures = picks
            Task { await submit(student: student, pictures: pictures) }
        }
    }

    private func submit(student: APIClient.SchoolRoster.Student, pictures: [String]) async {
        submitting = true
        errorCode = nil
        let session: APIClient.SchoolSession
        do {
            session = try await APIClient.shared.schoolSignIn(
                code: code, studentId: student.id, pictures: pictures
            )
        } catch {
            submitting = false
            let failed = (error as? APIClient.SchoolError)?.code ?? "generic"
            if failed == "wrong_pictures" {
                errorCode = failed
                // No attempt counter, ever: this only clears the slots so
                // they can try again.
                shaking = true
                if !reduceMotion {
                    withAnimation(.linear(duration: 0.45)) { shakeTrigger += 1 }
                }
                try? await Task.sleep(for: Self.shakeDuration)
                shaking = false
                picks = []
            } else {
                errorCode = failed
                picks = []
            }
            return
        }

        do {
            try await auth.signInAsStudent(
                accessToken: session.access_token, refreshToken: session.refresh_token
            )
        } catch {
            submitting = false
            errorCode = "generic"
            picks = []
            return
        }
        // Cleared here too, not only on failure: the cover can linger a beat
        // after isSignedIn flips, and a pad left disabled looks broken.
        submitting = false
        Haptics.celebrate()
        speaker.stop()
        // The sign-in flow closes when isSignedIn flips;
        // land the child on their shelf, like the web's /bookshelf.
        AppRouter.shared.selectedTab = .books
    }
}

/// Side-to-side shake for a wrong guess. Driven by an ever-increasing
/// counter so each wrong guess animates one full shake and settles at 0.
private struct ShakeEffect: GeometryEffect {
    var travel: CGFloat
    var animatableData: CGFloat {
        get { travel }
        set { travel = newValue }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: 10 * sin(travel * .pi * 6), y: 0))
    }
}

private struct PadButtonStyle: ButtonStyle {
    let reduceMotion: Bool
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.94 : 1)
            .animation(reduceMotion ? nil : .spring(response: 0.2, dampingFraction: 0.6),
                       value: configuration.isPressed)
    }
}

/// Every child-facing sentence in the class sign-in. Keyed like the web's
/// school.json so the two stay recognisably the same copy.
enum SchoolCopy {
    static var pageTitle: LocalizedStringResource { AppText("school.page_title", defaultValue: "My Class") }
    static var codeHeading: LocalizedStringResource { AppText("school.code_step.heading", defaultValue: "Type your class code") }
    static var codeHint: LocalizedStringResource { AppText("school.code_step.hint", defaultValue: "Ask your teacher for the code.") }
    static var codeAccessibility: LocalizedStringResource { AppText("school.code_step.input_accessibility", defaultValue: "Class code, 6 letters and numbers") }
    static var codeChecking: LocalizedStringResource { AppText("school.code_step.checking", defaultValue: "Looking for your class…") }
    static var nameHeading: LocalizedStringResource { AppText("school.name_step.heading", defaultValue: "Which one is you?") }
    static var notMyClass: LocalizedStringResource { AppText("school.name_step.not_my_class", defaultValue: "Not my class") }
    static var pictureHeading: LocalizedStringResource { AppText("school.picture_step.heading", defaultValue: "Pick your 3 pictures") }
    static var backOne: LocalizedStringResource { AppText("school.picture_step.back", defaultValue: "Back one") }
    static var backOneAccessibility: LocalizedStringResource { AppText("school.picture_step.back_accessibility", defaultValue: "Remove the last picture") }
    static var startOver: LocalizedStringResource { AppText("school.picture_step.start_over", defaultValue: "Start over") }
    static var pictureChecking: LocalizedStringResource { AppText("school.picture_step.checking", defaultValue: "Checking…") }
    static var listen: LocalizedStringResource { AppText("school.actions.listen", defaultValue: "Read this out loud") }

    /// Mirrors errorMessageKey() in ClassSignInPage.jsx: every server code
    /// lands on one of seven sentences. student_not_found, sign_in_failed,
    /// upstream, bad_request, not_configured and a network failure are not
    /// anything a child can act on, so they all read "generic".
    static func error(_ code: String) -> LocalizedStringResource {
        switch code {
        case "class_not_found":
            AppText("school.errors.class_not_found", defaultValue: "We can't find that class. Check the code with your teacher.")
        case "sign_in_closed", "class_paused", "class_resting":
            AppText("school.errors.class_unavailable", defaultValue: "Your class is taking a break. Ask your teacher.")
        case "too_many":
            AppText("school.errors.too_many", defaultValue: "Let's wait a minute and try again.")
        case "wrong_pictures":
            AppText("school.errors.wrong_pictures", defaultValue: "Not quite. Try again!")
        case "locked":
            AppText("school.errors.locked", defaultValue: "Take a little break and try again soon.")
        case "ask_teacher":
            AppText("school.errors.ask_teacher", defaultValue: "Ask your teacher to help you sign in.")
        default:
            AppText("school.errors.generic", defaultValue: "Something went wrong. Let's try again.")
        }
    }
}
