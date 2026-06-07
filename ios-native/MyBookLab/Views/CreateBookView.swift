// Phase 3 — Create Book wizard. Multi-step flow that builds up a draft
// Book and saves it to Supabase via BookshelfStore when complete.
// Currently implements steps 0–3 (author intro → character → setting →
// title). Page generation and illustrations come in Phase 4.
import SwiftUI
import UIKit
import PhotosUI

struct CreateBookView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(BookshelfStore.self) private var bookshelf
    @Environment(SubscriptionStore.self) private var subs
    @State private var draft = BookDraftStore.shared
    @State private var showingSignIn = false
    @State private var wizardStarted = false
    @State private var showingCelebrationPaywall = false

    var body: some View {
        NavigationStack {
            ZStack {
                CosmicBackground()
                Group {
                    if draft.book == nil {
                        // Landing hero — shown to everyone on app open.
                        // "Create a Book" either starts the wizard (if
                        // signed in) or prompts sign-in first.
                        HeroLanding(onCreate: startCreating)
                    } else {
                        wizardSteps
                            .transition(.asymmetric(
                                insertion: .move(edge: .trailing).combined(with: .opacity),
                                removal: .move(edge: .leading).combined(with: .opacity)
                            ))
                            .id(draft.step)
                    }
                }
            }
            .navigationTitle(draft.book == nil ? "" : navTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if draft.book != nil {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Cancel") {
                            withAnimation { draft.clear() }
                        }
                        .foregroundStyle(.white)
                    }
                }
            }
            .toolbarBackground(.hidden, for: .navigationBar)
            .sheet(isPresented: $showingSignIn) {
                NavigationStack { SignInView() }
                    .presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $showingCelebrationPaywall) {
                NavigationStack { PaywallView(context: .celebration) }
                    .presentationDragIndicator(.visible)
            }
        }
    }

    private func startCreating() {
        guard auth.isSignedIn else {
            showingSignIn = true
            return
        }
        // Open the wizard at the author-intro step (the step pre-fills
        // the name from the signed-in display name, but the user can
        // change it — e.g. to their kid's name).
        withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
            draft.begin()
        }
    }

    private var navTitle: String {
        guard draft.book != nil else { return "Create a Book" }
        switch draft.step {
        case 1: return "Your character"
        case 2: return "Where it happens"
        case 3: return "Title your book"
        case 4: return "Write your story"
        case 5: return "All set"
        default: return "Create"
        }
    }

    @ViewBuilder
    private var wizardSteps: some View {
        switch draft.step {
        case 1: CharacterStep(draft: $draft)
        case 2: SettingStep(draft: $draft)
        case 3: TitleStep(draft: $draft)
        case 4: PagesStep(draft: $draft)
        case 5: ReadyStep(draft: $draft, onSave: saveDraft)
        default: AuthorIntroStep(onContinue: { name, age in
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                draft.setAuthor(name: name, age: age)
            }
        })
        }
    }

    private func saveDraft() {
        guard let book = draft.book, let userId = auth.user?.id.uuidString else { return }
        let wasFirstBook = bookshelf.books.isEmpty
        Task {
            try? await bookshelf.save(book, userId: userId)
            draft.clear()
            // Celebratory paywall: when a non-paying user finishes their
            // FIRST book, surface the paywall at the peak emotional
            // moment as a celebration ("Your first book is done! 🎉")
            // rather than a wall. Strong conversion lift, no friction
            // for paying users (skipped).
            if wasFirstBook && !subs.isPaid {
                try? await Task.sleep(nanoseconds: 600_000_000) // wait for navigation
                showingCelebrationPaywall = true
            }
        }
    }

    private var signedOutPitch: some View {
        VStack(spacing: 22) {
            Text("✨")
                .font(.system(size: 64))
            Text("Make your story shine")
                .font(.system(.title2, design: .rounded).bold())
                .foregroundStyle(.white)
            Text("Sign in to save your books and bring them to life with AI illustrations.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.75))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            SparkleButton(action: { showingSignIn = true }) {
                Text("Sign in")
            }
            .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Step 0: Author intro

private struct AuthorIntroStep: View {
    let onContinue: (_ name: String, _ age: Int?) -> Void
    @Environment(AuthStore.self) private var auth
    @State private var name = ""
    @State private var ageText = ""
    @State private var didPrefill = false

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 6) {
                    Text(greeting)
                        .font(.system(.title, design: .rounded).bold())
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                    Text("Who's the author of this story?")
                        .foregroundStyle(.white.opacity(0.75))
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 24)
                .padding(.horizontal, 24)

                VStack(spacing: 12) {
                    TextField("", text: $name,
                              prompt: Text("Your name").foregroundStyle(.white.opacity(0.4)))
                        .textInputAutocapitalization(.words)
                        .padding(14)
                        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
                        .foregroundStyle(.white)

                    TextField("", text: $ageText,
                              prompt: Text("Your age (optional)").foregroundStyle(.white.opacity(0.4)))
                        .keyboardType(.numberPad)
                        .padding(14)
                        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
                        .foregroundStyle(.white)
                }
                .padding(.horizontal)

                SparkleButton(action: {
                    onContinue(name.trimmingCharacters(in: .whitespaces), Int(ageText))
                }) {
                    Text("Let's begin")
                }
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                .padding(.horizontal)

                Spacer(minLength: 40)
            }
        }
        .onAppear {
            // Pre-fill with the signed-in user's display name on first
            // appearance. Don't overwrite once the user has typed.
            guard !didPrefill else { return }
            didPrefill = true
            if let dn = auth.displayName, !dn.isEmpty, name.isEmpty {
                name = dn
            }
        }
    }

    /// "Hi, Damiano!" when we know who they are; otherwise the
    /// generic "Hi, storyteller!" fallback.
    private var greeting: String {
        if let dn = auth.displayName, !dn.isEmpty {
            return "Hi, \(dn)!"
        }
        return "Hi, storyteller!"
    }
}

// MARK: - Step 1: Character

private struct CharacterStep: View {
    @Binding var draft: BookDraftStore
    @Environment(AuthStore.self) private var auth
    @State private var name = ""
    @State private var emoji = "🦊"
    @State private var description = ""
    @State private var heroImage: String?          // generated hero portrait (data URL)
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var showPhotoPicker = false
    @State private var showParentalGate = false
    @State private var generatingHero = false
    @State private var heroError: String?

    private let emojiOptions: [String] = [
        // Animals
        "🦊", "🐻", "🐰", "🦄", "🐉", "🦁", "🐱", "🐶", "🐢", "🦉", "🐸", "🐼",
        "🐨", "🐯", "🦒", "🐘", "🦓", "🦝", "🐺", "🦔", "🐝", "🦋", "🐙", "🦕",
        "🐧", "🦜", "🦢", "🦩", "🐬", "🐳", "🦈", "🐠",
        // People & heroes
        "👦", "👧", "🧒", "👶", "🧑‍🚀", "🦸", "🦸‍♀️", "🧚", "🧚‍♂️", "🧜‍♀️", "🧞", "🧙",
        "🧙‍♀️", "👸", "🤴", "🥷", "🤖", "👽", "🎅", "🧝",
        // Fun & magical
        "🌟", "⭐️", "🌈", "🔮", "🎈", "🚀", "🏰", "👑", "🍪", "🦷", "❄️", "🔥",
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 6) {
                    Text("Create your hero")
                        .font(.system(.title2, design: .rounded).bold())
                        .foregroundStyle(.white)
                    Text("Who is the main character of your story?")
                        .foregroundStyle(.white.opacity(0.75))
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 16)

                // Name + description first — kids name their hero before
                // choosing how they look (photo or emoji below).
                VStack(spacing: 12) {
                    TextField("", text: $name,
                              prompt: Text("Character name").foregroundStyle(.white.opacity(0.4)))
                        .textInputAutocapitalization(.words)
                        .padding(14)
                        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
                        .foregroundStyle(.white)
                    TextField("", text: $description,
                              prompt: Text("Something special about them (optional)").foregroundStyle(.white.opacity(0.4)),
                              axis: .vertical)
                        .lineLimit(3...5)
                        .padding(14)
                        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
                        .foregroundStyle(.white)
                }
                .padding(.horizontal)

                // Hero portrait — a kid can turn a photo into a cartoon
                // hero, or just use an emoji below.
                heroPortraitSection

                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 12) {
                    ForEach(emojiOptions, id: \.self) { e in
                        Button { emoji = e } label: {
                            Text(e)
                                .font(.system(size: 36))
                                .frame(width: 60, height: 60)
                                .background(
                                    RoundedRectangle(cornerRadius: 14)
                                        .fill(emoji == e ? Color.purple.opacity(0.4) : Color.white.opacity(0.08))
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14)
                                        .strokeBorder(emoji == e ? Color.white : Color.clear, lineWidth: 2)
                                )
                        }
                    }
                }
                .padding(.horizontal)

                SparkleButton(action: {
                    var b = draft.book!
                    b.characters = [BookCharacter(
                        id: UUID().uuidString,
                        name: name.trimmingCharacters(in: .whitespaces),
                        emoji: emoji,
                        description: description.isEmpty ? nil : description,
                        imageData: heroImage
                    )]
                    draft.book = b
                    withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) { draft.step = 2 }
                }) { Text("Continue") }
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                .padding(.horizontal)
            }
        }
        .sheet(isPresented: $showParentalGate) {
            HeroParentalGate(
                onSuccess: { showParentalGate = false; showPhotoPicker = true },
                onCancel: { showParentalGate = false }
            )
        }
        .photosPicker(isPresented: $showPhotoPicker, selection: $selectedPhoto, matching: .images)
        .onChange(of: selectedPhoto) { _, item in
            guard let item else { return }
            Task { await makeHeroFromPhoto(item) }
        }
        .onAppear {
            // Pre-fill when editing an existing character.
            if let c = draft.book?.characters.first, name.isEmpty {
                name = c.name
                emoji = c.emoji ?? "🦊"
                description = c.description ?? ""
                heroImage = c.imageData
            }
        }
    }

    // MARK: - Hero portrait

    @ViewBuilder
    private var heroPortraitSection: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle().fill(.white.opacity(0.08)).frame(width: 120, height: 120)
                if let data = heroImage, let img = decodeImage(data) {
                    Image(uiImage: img)
                        .resizable().scaledToFill()
                        .frame(width: 120, height: 120)
                        .clipShape(Circle())
                } else {
                    Text(emoji).font(.system(size: 56))
                }
                if generatingHero {
                    Circle().fill(.black.opacity(0.4)).frame(width: 120, height: 120)
                    ProgressView().tint(.white)
                }
            }
            .overlay(Circle().strokeBorder(.white.opacity(0.25), lineWidth: 2).frame(width: 120, height: 120))
            .shadow(color: .purple.opacity(0.5), radius: 14, y: 6)

            Button {
                if auth.isSignedIn { showParentalGate = true }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "camera.fill")
                    Text(heroImage == nil ? "Turn a photo into your hero" : "Change hero photo")
                }
                .font(.callout.bold())
                .foregroundStyle(.yellow)
            }

            if let heroError {
                Text(heroError).font(.caption).foregroundStyle(.red.opacity(0.9))
                    .multilineTextAlignment(.center).padding(.horizontal, 24)
            }
            Text("Or pick an emoji hero below 👇")
                .font(.caption).foregroundStyle(.white.opacity(0.55))
        }
    }

    private func makeHeroFromPhoto(_ item: PhotosPickerItem) async {
        guard let token = auth.accessToken else { return }
        generatingHero = true
        heroError = nil
        defer { generatingHero = false }
        do {
            guard let data = try await item.loadTransferable(type: Data.self),
                  let original = UIImage(data: data) else {
                heroError = "Couldn't read that photo."
                return
            }
            let resized = original.resizedSquare(to: 768)
            guard let jpeg = resized.jpegData(compressionQuality: 0.85) else {
                heroError = "Couldn't process that photo."
                return
            }
            let dataUrl = "data:image/jpeg;base64,\(jpeg.base64EncodedString())"
            let res = try await APIClient.shared.generateAvatar(
                .init(features: nil, artStyle: "cartoon", sourceImage: dataUrl),
                bearerToken: token
            )
            heroImage = res.image
            Haptics.celebrate()
        } catch {
            heroError = "Couldn't create your hero: \(error.localizedDescription)"
        }
    }

    private func decodeImage(_ dataUrl: String) -> UIImage? {
        let parts = dataUrl.split(separator: ",", maxSplits: 1)
        guard parts.count == 2, let data = Data(base64Encoded: String(parts[1])) else { return nil }
        return UIImage(data: data)
    }
}

// Parental gate shown before the photo picker for the hero flow.
private struct HeroParentalGate: View {
    let onSuccess: () -> Void
    let onCancel: () -> Void
    @State private var a = Int.random(in: 11...19)
    @State private var b = Int.random(in: 11...19)
    @State private var answer = ""
    @State private var wrong = false

    var body: some View {
        VStack(spacing: 20) {
            Text("👋 Grown-up check").font(.system(.title3, design: .rounded).bold())
            Text("Ask a grown-up to solve this before adding a photo.")
                .font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
            Text("\(a) + \(b) = ?").font(.system(.largeTitle, design: .rounded).bold())
            TextField("Answer", text: $answer)
                .keyboardType(.numberPad).multilineTextAlignment(.center)
                .padding().background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal, 32)
            if wrong { Text("Try again.").foregroundStyle(.red).font(.footnote) }
            HStack(spacing: 12) {
                Button("Cancel", role: .cancel) { onCancel() }.frame(maxWidth: .infinity).padding(12)
                Button("Continue") {
                    if Int(answer) == a + b { onSuccess() } else { wrong = true; answer = "" }
                }
                .frame(maxWidth: .infinity).padding(12)
                .background(.purple, in: RoundedRectangle(cornerRadius: 12)).foregroundStyle(.white)
            }
            .padding(.horizontal, 32)
            Spacer()
        }
        .padding(.top, 28)
        .presentationDetents([.medium])
    }
}

// MARK: - Step 2: Setting

private struct SettingStep: View {
    @Binding var draft: BookDraftStore
    @State private var selectedIndex: Int = 0

    private let presets: [(name: String, emoji: String, description: String)] = [
        ("The Glowing Forest", "🌲", "A magical forest where stars come down at night."),
        ("The Cloud Kingdom", "☁️", "A floating land high above the world."),
        ("The Coral City", "🐠", "An underwater city of bright coral towers."),
        ("The Cookie Planet", "🍪", "A planet made of every dessert imaginable."),
        ("The Snow Castle", "🏰", "A castle of ice and silver moonlight."),
        ("The Dinosaur Valley", "🦕", "A hidden valley where dinosaurs still play."),
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                VStack(spacing: 6) {
                    Text("Where does it happen?")
                        .font(.system(.title2, design: .rounded).bold())
                        .foregroundStyle(.white)
                    Text("Pick the world your story lives in.")
                        .foregroundStyle(.white.opacity(0.75))
                }
                .padding(.top, 16)

                VStack(spacing: 10) {
                    ForEach(Array(presets.enumerated()), id: \.offset) { i, p in
                        Button { selectedIndex = i } label: {
                            HStack(spacing: 14) {
                                Text(p.emoji).font(.system(size: 32))
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(p.name).font(.headline).foregroundStyle(.white)
                                    Text(p.description).font(.caption).foregroundStyle(.white.opacity(0.7))
                                }
                                Spacer()
                                if selectedIndex == i {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.purple)
                                }
                            }
                            .padding(14)
                            .background(
                                RoundedRectangle(cornerRadius: 14)
                                    .fill(selectedIndex == i ? Color.purple.opacity(0.25) : Color.white.opacity(0.06))
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 14)
                                    .strokeBorder(selectedIndex == i ? Color.white.opacity(0.6) : Color.clear, lineWidth: 1)
                            )
                        }
                    }
                }
                .padding(.horizontal)

                SparkleButton(action: {
                    let p = presets[selectedIndex]
                    var b = draft.book!
                    b.setting = BookSetting(
                        id: UUID().uuidString,
                        name: p.name,
                        label: p.name,
                        emoji: p.emoji,
                        description: p.description
                    )
                    draft.book = b
                    withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) { draft.step = 3 }
                }) { Text("Continue") }
                .padding(.horizontal)
            }
        }
    }
}

// MARK: - Step 3: Title

private struct TitleStep: View {
    @Binding var draft: BookDraftStore
    @State private var title = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 6) {
                    Text("What's the title?")
                        .font(.system(.title2, design: .rounded).bold())
                        .foregroundStyle(.white)
                    Text("Every great book needs a name.")
                        .foregroundStyle(.white.opacity(0.75))
                }
                .padding(.top, 16)

                TextField("", text: $title,
                          prompt: Text("e.g. The Brave Star Bear").foregroundStyle(.white.opacity(0.4)))
                    .textInputAutocapitalization(.words)
                    .padding(14)
                    .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
                    .foregroundStyle(.white)
                    .font(.title3)
                    .padding(.horizontal)

                SparkleButton(action: {
                    var b = draft.book!
                    b.title = title.trimmingCharacters(in: .whitespaces)
                    if b.pages.isEmpty {
                        b.pages = [BookPage(id: 1, pageNumber: 1, text: "", illustrationData: nil)]
                    }
                    draft.book = b
                    withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) { draft.step = 4 }
                }) { Text("Start writing") }
                .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
                .padding(.horizontal)
            }
        }
    }
}

// MARK: - Step 4: Pages

private struct PagesStep: View {
    @Binding var draft: BookDraftStore
    @Environment(AuthStore.self) private var auth
    @State private var currentIndex: Int = 0
    @State private var generatingIllustration = false
    @State private var generationError: String?
    @State private var showStoryBuddy = false

    var body: some View {
        VStack(spacing: 12) {
            // Page tab strip — shows current page index + lets user
            // jump between pages.
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    if let pages = draft.book?.pages {
                        ForEach(Array(pages.enumerated()), id: \.offset) { i, _ in
                            Button {
                                currentIndex = i
                            } label: {
                                Text("\(i + 1)")
                                    .font(.callout.bold())
                                    .frame(width: 36, height: 36)
                                    .background(
                                        Circle()
                                            .fill(currentIndex == i
                                                  ? Color.purple
                                                  : Color.white.opacity(0.12))
                                    )
                                    .foregroundStyle(.white)
                            }
                        }
                        Button {
                            addPage()
                        } label: {
                            Image(systemName: "plus")
                                .frame(width: 36, height: 36)
                                .background(Circle().fill(Color.white.opacity(0.12)))
                                .foregroundStyle(.white)
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.top, 12)
            }

            ScrollView {
                pageEditor
            }

            VStack(spacing: 10) {
                if let error = generationError {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red.opacity(0.9))
                }

                HStack(spacing: 10) {
                    Button { showStoryBuddy = true } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "bubble.left.and.bubble.right.fill")
                            Text("Story Buddy")
                        }
                        .frame(maxWidth: .infinity)
                        .padding(12)
                        .background(.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(.white)
                    }

                    Button {
                        Task { await generateIllustration() }
                    } label: {
                        HStack(spacing: 6) {
                            if generatingIllustration {
                                ProgressView().tint(.white)
                            } else {
                                Image(systemName: "wand.and.stars")
                            }
                            Text(generatingIllustration ? "Drawing…" : "Illustrate")
                        }
                        .frame(maxWidth: .infinity)
                        .padding(12)
                        .background(.purple.opacity(0.85), in: RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(.white)
                    }
                    .disabled(generatingIllustration || currentPageText.isEmpty)
                }

                SparkleButton(action: {
                    withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) { draft.step = 5 }
                }, style: .accent) {
                    Text("I'm done writing")
                }
                .disabled(allPagesEmpty)
            }
            .padding(.horizontal)
            .padding(.bottom, 16)
        }
        .sheet(isPresented: $showStoryBuddy) {
            StoryBuddyView(currentPageText: currentPageText) { suggestion in
                appendToCurrentPage(suggestion)
            }
            .presentationDetents([.medium, .large])
        }
    }

    @ViewBuilder
    private var pageEditor: some View {
        if let book = draft.book, currentIndex < book.pages.count {
            VStack(alignment: .leading, spacing: 12) {
                // Illustration slot
                Group {
                    if let data = book.pages[currentIndex].illustrationData,
                       let url = URL(string: data) {
                        AsyncImage(url: url) { phase in
                            if let img = phase.image {
                                img.resizable()
                                    .aspectRatio(contentMode: .fill)
                            } else if phase.error != nil {
                                Image(systemName: "photo")
                                    .foregroundStyle(.white.opacity(0.5))
                            } else {
                                ProgressView().tint(.white)
                            }
                        }
                    } else if let data = book.pages[currentIndex].illustrationData,
                              data.hasPrefix("data:image") {
                        // base64 data URL — render via UIImage
                        if let img = decodeBase64Image(data) {
                            Image(uiImage: img).resizable().aspectRatio(contentMode: .fill)
                        }
                    } else {
                        VStack(spacing: 6) {
                            Image(systemName: "sparkles")
                                .font(.system(size: 40))
                                .foregroundStyle(.white.opacity(0.5))
                            Text("Tap Illustrate to add a picture")
                                .font(.caption)
                                .foregroundStyle(.white.opacity(0.5))
                        }
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 200)
                .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 16))
                .clipShape(RoundedRectangle(cornerRadius: 16))

                Text("Page \(currentIndex + 1)")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.6))

                TextEditor(text: pageTextBinding)
                    .scrollContentBackground(.hidden)
                    .padding(10)
                    .frame(minHeight: 160)
                    .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
                    .foregroundStyle(.white)

                if book.pages.count > 1 {
                    Button(role: .destructive) {
                        deleteCurrentPage()
                    } label: {
                        Label("Delete page", systemImage: "trash")
                            .frame(maxWidth: .infinity)
                            .padding(12)
                            .background(.red.opacity(0.18), in: RoundedRectangle(cornerRadius: 12))
                    }
                }
            }
            .padding(.horizontal)
        }
    }

    // MARK: - Bindings + helpers

    private var pageTextBinding: Binding<String> {
        Binding(
            get: { draft.book?.pages[safe: currentIndex]?.text ?? "" },
            set: { newValue in
                guard var b = draft.book, currentIndex < b.pages.count else { return }
                b.pages[currentIndex].text = newValue
                draft.book = b
            }
        )
    }

    private var currentPageText: String {
        draft.book?.pages[safe: currentIndex]?.text ?? ""
    }

    private var allPagesEmpty: Bool {
        (draft.book?.pages.allSatisfy { $0.text.trimmingCharacters(in: .whitespaces).isEmpty }) ?? true
    }

    private func addPage() {
        guard var b = draft.book else { return }
        let nextNum = (b.pages.last?.pageNumber ?? 0) + 1
        b.pages.append(BookPage(id: nextNum, pageNumber: nextNum, text: "", illustrationData: nil))
        draft.book = b
        currentIndex = b.pages.count - 1
    }

    private func deleteCurrentPage() {
        guard var b = draft.book, b.pages.count > 1, currentIndex < b.pages.count else { return }
        b.pages.remove(at: currentIndex)
        // Re-number to keep pageNumbers contiguous
        for i in b.pages.indices { b.pages[i].pageNumber = i + 1; b.pages[i].id = i + 1 }
        draft.book = b
        currentIndex = max(0, currentIndex - 1)
    }

    private func appendToCurrentPage(_ text: String) {
        guard var b = draft.book, currentIndex < b.pages.count else { return }
        let existing = b.pages[currentIndex].text
        let separator = existing.isEmpty ? "" : "\n\n"
        b.pages[currentIndex].text = existing + separator + text
        draft.book = b
    }

    private func generateIllustration() async {
        guard let token = auth.accessToken,
              let book = draft.book,
              currentIndex < book.pages.count else { return }
        let pageText = book.pages[currentIndex].text
        let characterDesc = book.characters.first.flatMap { c -> String? in
            "\(c.name)\(c.description.map { ", " + $0 } ?? "")"
        } ?? ""
        let settingDesc = book.setting?.description ?? ""
        let prompt = """
            Children's storybook illustration. Scene: \(pageText)
            Character: \(characterDesc). Setting: \(settingDesc).
            Bright friendly cartoon style, vibrant colors, no text in image.
            """

        generatingIllustration = true
        generationError = nil
        defer { generatingIllustration = false }
        do {
            let res = try await APIClient.shared.generateImage(
                .init(prompt: prompt, style: "cartoon"),
                bearerToken: token
            )
            guard var b = draft.book, currentIndex < b.pages.count else { return }
            b.pages[currentIndex].illustrationData = res.image
            draft.book = b
        } catch {
            generationError = "Couldn't generate illustration: \(error.localizedDescription)"
        }
    }

    private func decodeBase64Image(_ dataURL: String) -> UIImage? {
        let parts = dataURL.split(separator: ",", maxSplits: 1)
        guard parts.count == 2, let data = Data(base64Encoded: String(parts[1])) else { return nil }
        return UIImage(data: data)
    }
}

// Convenience array safe-subscript
private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

// MARK: - Step 5: Ready

private struct ReadyStep: View {
    @Binding var draft: BookDraftStore
    let onSave: () -> Void

    @Environment(AuthStore.self) private var auth
    @State private var confettiTrigger = 0
    @State private var generatingCover = false
    @State private var coverError: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                coverArt
                    .frame(width: 200, height: 200)
                    .clipShape(RoundedRectangle(cornerRadius: 20))
                    .shadow(color: .purple.opacity(0.6), radius: 18, y: 8)
                    .padding(.top, 24)

                if let b = draft.book {
                    Text(b.title)
                        .font(.system(.title, design: .rounded).bold())
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)

                    Text("by \(b.authorName)")
                        .foregroundStyle(.white.opacity(0.7))

                    if let c = b.characters.first {
                        HStack(spacing: 10) {
                            if let data = c.imageData, let img = heroThumb(data) {
                                Image(uiImage: img)
                                    .resizable().scaledToFill()
                                    .frame(width: 32, height: 32)
                                    .clipShape(Circle())
                            } else {
                                Text(c.emoji ?? "✨").font(.title)
                            }
                            Text(c.name).foregroundStyle(.white)
                        }
                        .padding(10)
                        .background(.white.opacity(0.08), in: Capsule())
                    }
                }

                // AI cover generation — the book's "avatar".
                SparkleButton(action: { Task { await generateCover() } }, style: .secondary) {
                    HStack(spacing: 8) {
                        if generatingCover { ProgressView().tint(.white) }
                        else { Image(systemName: "wand.and.stars") }
                        Text(generatingCover ? "Painting cover…"
                             : (draft.book?.coverImage == nil ? "Generate AI cover" : "Regenerate cover"))
                    }
                }
                .disabled(generatingCover)
                .padding(.horizontal)

                if let coverError {
                    Text(coverError)
                        .font(.footnote)
                        .foregroundStyle(.red.opacity(0.9))
                        .padding(.horizontal)
                }

                SparkleButton(action: {
                    confettiTrigger &+= 1
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                        onSave()
                    }
                }) {
                    Text("Save to bookshelf")
                }
                .padding(.horizontal)
                .padding(.top, 8)
            }
            .padding(.bottom, 32)
        }
        .overlay(Confetti(trigger: confettiTrigger))
    }

    // Shows the generated cover if present, else an emoji-on-gradient
    // placeholder built from the character + setting.
    @ViewBuilder
    private var coverArt: some View {
        let raw = draft.book?.coverImage ?? ""
        if raw.hasPrefix("http") || raw.hasPrefix("data:"), let url = URL(string: raw) {
            AsyncImage(url: url) { phase in
                if let img = phase.image { img.resizable().scaledToFill() }
                else { coverPlaceholder }
            }
        } else {
            coverPlaceholder
        }
    }

    private var coverPlaceholder: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(hex: draft.book?.colors?.cover) ?? .purple,
                    (Color(hex: draft.book?.colors?.accent) ?? .pink).opacity(0.7)
                ],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            Text(draft.book?.characters.first?.emoji
                 ?? draft.book?.setting?.emoji ?? "📖")
                .font(.system(size: 84))
        }
    }

    private func heroThumb(_ dataUrl: String) -> UIImage? {
        let parts = dataUrl.split(separator: ",", maxSplits: 1)
        guard parts.count == 2, let data = Data(base64Encoded: String(parts[1])) else { return nil }
        return UIImage(data: data)
    }

    private func generateCover() async {
        guard let token = auth.accessToken, let book = draft.book else { return }
        generatingCover = true
        coverError = nil
        defer { generatingCover = false }

        let character = book.characters.first.map { c in
            "\(c.name)\(c.description.map { ", " + $0 } ?? "")"
        } ?? "a friendly hero"
        let setting = book.setting?.description ?? book.setting?.name ?? "a magical place"
        let prompt = """
            Children's storybook front cover illustration for "\(book.title)".
            Main character: \(character). Setting: \(setting).
            Whimsical, vibrant, magical, centered composition suitable for a
            book cover. Bright friendly cartoon style. No text, no words.
            """
        do {
            let res = try await APIClient.shared.generateImage(
                .init(prompt: prompt, style: "cartoon"),
                bearerToken: token
            )
            var b = book
            b.coverImage = res.image
            draft.book = b
        } catch {
            coverError = "Couldn't paint the cover: \(error.localizedDescription)"
        }
    }
}
