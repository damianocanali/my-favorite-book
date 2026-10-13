// The worksheet copy on the iPad (spec 2026-10-01 §2): each template's
// title, description and default box prompts, and the worksheet screens'
// own strings. Same keys and wording as the web (school.json worksheet.*);
// tests/worksheets-ios.test.js checks every key here is in
// Localizable.xcstrings with the web's EN and IT. Generated from
// school.json — edit there, then regenerate, never one side alone.
import Foundation

enum WorksheetCopy {
    /// The library card's name (and the fill-in screen's kicker).
    static func title(_ templateId: String) -> LocalizedStringResource {
        switch templateId {
        case "story_map": AppText("school.worksheet.templates.story_map.title", defaultValue: "Story map")
        case "beginning_middle_end": AppText("school.worksheet.templates.beginning_middle_end.title", defaultValue: "Beginning, middle, end")
        case "sequence": AppText("school.worksheet.templates.sequence.title", defaultValue: "Sequence of events")
        case "storyboard": AppText("school.worksheet.templates.storyboard.title", defaultValue: "Storyboard")
        case "problem_solution": AppText("school.worksheet.templates.problem_solution.title", defaultValue: "Problem and solution")
        case "story_mountain": AppText("school.worksheet.templates.story_mountain.title", defaultValue: "Story mountain")
        case "character_profile": AppText("school.worksheet.templates.character_profile.title", defaultValue: "Character profile")
        case "setting_sketch": AppText("school.worksheet.templates.setting_sketch.title", defaultValue: "Setting sketch")
        case "five_senses": AppText("school.worksheet.templates.five_senses.title", defaultValue: "Five senses")
        case "character_change": AppText("school.worksheet.templates.character_change.title", defaultValue: "How a character changes")
        case "sentence_starters": AppText("school.worksheet.templates.sentence_starters.title", defaultValue: "Sentence starters")
        case "describing_words": AppText("school.worksheet.templates.describing_words.title", defaultValue: "Describing words")
        case "word_web": AppText("school.worksheet.templates.word_web.title", defaultValue: "Word web")
        case "stretch_sentence": AppText("school.worksheet.templates.stretch_sentence.title", defaultValue: "Stretch a sentence")
        case "dialogue": AppText("school.worksheet.templates.dialogue.title", defaultValue: "Dialogue")
        case "acrostic": AppText("school.worksheet.templates.acrostic.title", defaultValue: "Acrostic poem")
        case "haiku": AppText("school.worksheet.templates.haiku.title", defaultValue: "Haiku")
        case "i_am_poem": AppText("school.worksheet.templates.i_am_poem.title", defaultValue: "“I am” poem")
        case "cinquain": AppText("school.worksheet.templates.cinquain.title", defaultValue: "Cinquain")
        case "opinion": AppText("school.worksheet.templates.opinion.title", defaultValue: "Opinion paragraph (OREO)")
        case "letter": AppText("school.worksheet.templates.letter.title", defaultValue: "Letter to a character")
        case "thank_you": AppText("school.worksheet.templates.thank_you.title", defaultValue: "Thank-you note")
        case "persuade": AppText("school.worksheet.templates.persuade.title", defaultValue: "Persuade me")
        case "book_report": AppText("school.worksheet.templates.book_report.title", defaultValue: "Book report")
        case "favorite_part": AppText("school.worksheet.templates.favorite_part.title", defaultValue: "My favorite part")
        case "predict": AppText("school.worksheet.templates.predict.title", defaultValue: "Make a prediction")
        case "compare_books": AppText("school.worksheet.templates.compare_books.title", defaultValue: "Compare two books")
        case "all_about": AppText("school.worksheet.templates.all_about.title", defaultValue: "All about…")
        case "how_to": AppText("school.worksheet.templates.how_to.title", defaultValue: "How-to")
        case "about_author": AppText("school.worksheet.templates.about_author.title", defaultValue: "About the author")
        case "feelings_checkin": AppText("school.worksheet.templates.feelings_checkin.title", defaultValue: "Feelings check-in")
        case "my_week": AppText("school.worksheet.templates.my_week.title", defaultValue: "My week")
        case "all_about_me": AppText("school.worksheet.templates.all_about_me.title", defaultValue: "All about me")
        default: AppText("school.worksheet.teacher.chip", defaultValue: "Worksheet")
        }
    }

    /// One line for the teacher: what the sheet is for.
    static func description(_ templateId: String) -> LocalizedStringResource {
        switch templateId {
        case "story_map": AppText("school.worksheet.templates.story_map.description", defaultValue: "Plan a story: who, where, the problem, what happens and the ending.")
        case "beginning_middle_end": AppText("school.worksheet.templates.beginning_middle_end.description", defaultValue: "Three big boxes for the three parts of a story.")
        case "sequence": AppText("school.worksheet.templates.sequence.description", defaultValue: "First, next, then, last.")
        case "storyboard": AppText("school.worksheet.templates.storyboard.description", defaultValue: "Six panels to sketch a story in order, with two lines under each.")
        case "problem_solution": AppText("school.worksheet.templates.problem_solution.description", defaultValue: "A problem, the tries that don’t work, and how it gets solved.")
        case "story_mountain": AppText("school.worksheet.templates.story_mountain.description", defaultValue: "Climb a story: beginning, build-up, big moment, wind-down, ending.")
        case "character_profile": AppText("school.worksheet.templates.character_profile.description", defaultValue: "Get to know a character before writing about them.")
        case "setting_sketch": AppText("school.worksheet.templates.setting_sketch.description", defaultValue: "Draw the place where a story happens, then describe it.")
        case "five_senses": AppText("school.worksheet.templates.five_senses.description", defaultValue: "Describe a place with sight, sound, smell, touch and taste.")
        case "character_change": AppText("school.worksheet.templates.character_change.description", defaultValue: "What a character is like at the start, what happens, and what they are like at the end.")
        case "sentence_starters": AppText("school.worksheet.templates.sentence_starters.description", defaultValue: "Starter phrases to finish in your own words.")
        case "describing_words": AppText("school.worksheet.templates.describing_words.description", defaultValue: "Pick a thing, draw it, and find five words that describe it.")
        case "word_web": AppText("school.worksheet.templates.word_web.description", defaultValue: "A big idea in the middle and six ideas around it.")
        case "stretch_sentence": AppText("school.worksheet.templates.stretch_sentence.description", defaultValue: "Who, did what, where, when and why — then one big sentence.")
        case "dialogue": AppText("school.worksheet.templates.dialogue.description", defaultValue: "Two characters talk: write their conversation with quotation marks.")
        case "acrostic": AppText("school.worksheet.templates.acrostic.description", defaultValue: "One line for each letter of a word.")
        case "haiku": AppText("school.worksheet.templates.haiku.description", defaultValue: "A tiny poem in three lines: 5, 7 and 5 syllables.")
        case "i_am_poem": AppText("school.worksheet.templates.i_am_poem.description", defaultValue: "A poem about you: I am, I wonder, I hear, I see, I want.")
        case "cinquain": AppText("school.worksheet.templates.cinquain.description", defaultValue: "A five-line poem: a noun, two describing words, three action words, a feeling, another name.")
        case "opinion": AppText("school.worksheet.templates.opinion.description", defaultValue: "Opinion, reason, example, opinion again.")
        case "letter": AppText("school.worksheet.templates.letter.description", defaultValue: "Write a letter to someone from a story.")
        case "thank_you": AppText("school.worksheet.templates.thank_you.description", defaultValue: "Say thank you to someone, and why.")
        case "persuade": AppText("school.worksheet.templates.persuade.description", defaultValue: "What should happen, three reasons, and a strong finish.")
        case "book_report": AppText("school.worksheet.templates.book_report.description", defaultValue: "Title, author, what it’s about, your favorite part, and a star rating.")
        case "favorite_part": AppText("school.worksheet.templates.favorite_part.description", defaultValue: "Draw and write about the best part of a book.")
        case "predict": AppText("school.worksheet.templates.predict.description", defaultValue: "Use clues to guess what happens next, then check.")
        case "compare_books": AppText("school.worksheet.templates.compare_books.description", defaultValue: "Two books side by side: what’s the same and what’s different.")
        case "all_about": AppText("school.worksheet.templates.all_about.description", defaultValue: "Teach the reader about a topic: three facts and a wow fact.")
        case "how_to": AppText("school.worksheet.templates.how_to.description", defaultValue: "Teach someone to do something, step by step.")
        case "about_author": AppText("school.worksheet.templates.about_author.description", defaultValue: "A page about the person who wrote the book: you.")
        case "feelings_checkin": AppText("school.worksheet.templates.feelings_checkin.description", defaultValue: "How you feel, why, and what would help — no scores, just words.")
        case "my_week": AppText("school.worksheet.templates.my_week.description", defaultValue: "A journal page about the week.")
        case "all_about_me": AppText("school.worksheet.templates.all_about_me.description", defaultValue: "Favorite things, what you’re good at, what you’re learning, and a dream.")
        default: AppText("school.worksheet.teacher.chip", defaultValue: "Worksheet")
        }
    }

    /// The big, kid-friendly title printed at the top of the sheet.
    static func heading(_ templateId: String) -> LocalizedStringResource {
        switch templateId {
        case "story_map": AppText("school.worksheet.templates.story_map.heading", defaultValue: "My Story Map")
        case "beginning_middle_end": AppText("school.worksheet.templates.beginning_middle_end.heading", defaultValue: "Beginning, Middle and End")
        case "sequence": AppText("school.worksheet.templates.sequence.heading", defaultValue: "First, Next, Then, Last")
        case "storyboard": AppText("school.worksheet.templates.storyboard.heading", defaultValue: "My Storyboard")
        case "problem_solution": AppText("school.worksheet.templates.problem_solution.heading", defaultValue: "Problem and Solution")
        case "story_mountain": AppText("school.worksheet.templates.story_mountain.heading", defaultValue: "My Story Mountain")
        case "character_profile": AppText("school.worksheet.templates.character_profile.heading", defaultValue: "My Character")
        case "setting_sketch": AppText("school.worksheet.templates.setting_sketch.heading", defaultValue: "My Story’s Setting")
        case "five_senses": AppText("school.worksheet.templates.five_senses.heading", defaultValue: "My Five Senses")
        case "character_change": AppText("school.worksheet.templates.character_change.heading", defaultValue: "How My Character Changes")
        case "sentence_starters": AppText("school.worksheet.templates.sentence_starters.heading", defaultValue: "Finish My Story")
        case "describing_words": AppText("school.worksheet.templates.describing_words.heading", defaultValue: "Words That Describe")
        case "word_web": AppText("school.worksheet.templates.word_web.heading", defaultValue: "My Word Web")
        case "stretch_sentence": AppText("school.worksheet.templates.stretch_sentence.heading", defaultValue: "Stretch My Sentence")
        case "dialogue": AppText("school.worksheet.templates.dialogue.heading", defaultValue: "Who Said What?")
        case "acrostic": AppText("school.worksheet.templates.acrostic.heading", defaultValue: "My Acrostic Poem")
        case "haiku": AppText("school.worksheet.templates.haiku.heading", defaultValue: "My Haiku")
        case "i_am_poem": AppText("school.worksheet.templates.i_am_poem.heading", defaultValue: "I Am")
        case "cinquain": AppText("school.worksheet.templates.cinquain.heading", defaultValue: "My Cinquain")
        case "opinion": AppText("school.worksheet.templates.opinion.heading", defaultValue: "My Opinion")
        case "letter": AppText("school.worksheet.templates.letter.heading", defaultValue: "My Letter")
        case "thank_you": AppText("school.worksheet.templates.thank_you.heading", defaultValue: "Thank You!")
        case "persuade": AppText("school.worksheet.templates.persuade.heading", defaultValue: "Let Me Convince You")
        case "book_report": AppText("school.worksheet.templates.book_report.heading", defaultValue: "My Book Report")
        case "favorite_part": AppText("school.worksheet.templates.favorite_part.heading", defaultValue: "My Favorite Part")
        case "predict": AppText("school.worksheet.templates.predict.heading", defaultValue: "What Will Happen?")
        case "compare_books": AppText("school.worksheet.templates.compare_books.heading", defaultValue: "Two Books, Side by Side")
        case "all_about": AppText("school.worksheet.templates.all_about.heading", defaultValue: "All About…")
        case "how_to": AppText("school.worksheet.templates.how_to.heading", defaultValue: "How To…")
        case "about_author": AppText("school.worksheet.templates.about_author.heading", defaultValue: "All About the Author")
        case "feelings_checkin": AppText("school.worksheet.templates.feelings_checkin.heading", defaultValue: "How I Feel Today")
        case "my_week": AppText("school.worksheet.templates.my_week.heading", defaultValue: "My Week")
        case "all_about_me": AppText("school.worksheet.templates.all_about_me.heading", defaultValue: "All About Me")
        default: AppText("school.worksheet.teacher.chip", defaultValue: "Worksheet")
        }
    }

    /// A few comma-separated synonyms the library search also matches.
    static func keywords(_ templateId: String) -> LocalizedStringResource? {
        switch templateId {
        case "story_map": AppText("school.worksheet.templates.story_map.keywords", defaultValue: "plan, plot, problem, characters, setting, events, outline")
        case "beginning_middle_end": AppText("school.worksheet.templates.beginning_middle_end.keywords", defaultValue: "story map, three parts, plot, retell, draw, pictures")
        case "sequence": AppText("school.worksheet.templates.sequence.keywords", defaultValue: "order, steps, sequence, retell, comic, events, draw")
        case "storyboard": AppText("school.worksheet.templates.storyboard.keywords", defaultValue: "comic, panels, pictures, plan, scenes, draw")
        case "problem_solution": AppText("school.worksheet.templates.problem_solution.keywords", defaultValue: "problem, solve, fix, try, solution, plot")
        case "story_mountain": AppText("school.worksheet.templates.story_mountain.keywords", defaultValue: "plot, climax, structure, rising action, arc, plan")
        case "character_profile": AppText("school.worksheet.templates.character_profile.keywords", defaultValue: "character, hero, describe, traits, personality, draw")
        case "setting_sketch": AppText("school.worksheet.templates.setting_sketch.keywords", defaultValue: "place, setting, where, when, describe, draw, senses")
        case "five_senses": AppText("school.worksheet.templates.five_senses.keywords", defaultValue: "senses, describe, see, hear, smell, touch, taste, place")
        case "character_change": AppText("school.worksheet.templates.character_change.keywords", defaultValue: "character, change, growth, traits, beginning, end")
        case "sentence_starters": AppText("school.worksheet.templates.sentence_starters.keywords", defaultValue: "starters, sentences, finish, beginnings, story, writing prompts")
        case "describing_words": AppText("school.worksheet.templates.describing_words.keywords", defaultValue: "adjectives, describe, words, vocabulary, senses")
        case "word_web": AppText("school.worksheet.templates.word_web.keywords", defaultValue: "brainstorm, mind map, ideas, web, cluster, vocabulary")
        case "stretch_sentence": AppText("school.worksheet.templates.stretch_sentence.keywords", defaultValue: "sentence, expand, grammar, details, who what where when why")
        case "dialogue": AppText("school.worksheet.templates.dialogue.keywords", defaultValue: "dialogue, conversation, quotation marks, talking, speech")
        case "acrostic": AppText("school.worksheet.templates.acrostic.keywords", defaultValue: "poem, poetry, letters, name, acrostic")
        case "haiku": AppText("school.worksheet.templates.haiku.keywords", defaultValue: "poem, poetry, syllables, nature, japanese, short")
        case "i_am_poem": AppText("school.worksheet.templates.i_am_poem.keywords", defaultValue: "poem, poetry, me, identity, self, feelings")
        case "cinquain": AppText("school.worksheet.templates.cinquain.keywords", defaultValue: "poem, poetry, five lines, adjectives, verbs")
        case "opinion": AppText("school.worksheet.templates.opinion.keywords", defaultValue: "opinion, OREO, persuasive, reasons, argue, paragraph")
        case "letter": AppText("school.worksheet.templates.letter.keywords", defaultValue: "letter, write to, greeting, mail, character")
        case "thank_you": AppText("school.worksheet.templates.thank_you.keywords", defaultValue: "thanks, card, letter, gratitude, kindness")
        case "persuade": AppText("school.worksheet.templates.persuade.keywords", defaultValue: "persuasive, opinion, reasons, convince, argue, should")
        case "book_report": AppText("school.worksheet.templates.book_report.keywords", defaultValue: "book, review, reading, report, stars, recommend")
        case "favorite_part": AppText("school.worksheet.templates.favorite_part.keywords", defaultValue: "book, reading, favorite, scene, draw, response")
        case "predict": AppText("school.worksheet.templates.predict.keywords", defaultValue: "predict, guess, clues, reading, check, next")
        case "compare_books": AppText("school.worksheet.templates.compare_books.keywords", defaultValue: "compare, contrast, books, same, different, venn")
        case "all_about": AppText("school.worksheet.templates.all_about.keywords", defaultValue: "facts, nonfiction, informational, topic, research, report")
        case "how_to": AppText("school.worksheet.templates.how_to.keywords", defaultValue: "instructions, steps, procedure, recipe, how to, sequence")
        case "about_author": AppText("school.worksheet.templates.about_author.keywords", defaultValue: "author, me, about me, biography, portrait, writer")
        case "feelings_checkin": AppText("school.worksheet.templates.feelings_checkin.keywords", defaultValue: "feelings, emotions, check-in, mood, wellbeing, SEL")
        case "my_week": AppText("school.worksheet.templates.my_week.keywords", defaultValue: "journal, week, reflection, diary, weekend")
        case "all_about_me": AppText("school.worksheet.templates.all_about_me.keywords", defaultValue: "me, myself, identity, favorites, dreams, back to school")
        default: nil
        }
    }

    /// The drawing box's label, for a sheet that has one on paper.
    static func picture(_ templateId: String) -> LocalizedStringResource? {
        switch templateId {
        case "problem_solution": AppText("school.worksheet.templates.problem_solution.picture", defaultValue: "Draw how it ends")
        case "character_profile": AppText("school.worksheet.templates.character_profile.picture", defaultValue: "Draw your character")
        case "setting_sketch": AppText("school.worksheet.templates.setting_sketch.picture", defaultValue: "Draw the place")
        case "describing_words": AppText("school.worksheet.templates.describing_words.picture", defaultValue: "Draw it")
        case "haiku": AppText("school.worksheet.templates.haiku.picture", defaultValue: "Draw your haiku")
        case "cinquain": AppText("school.worksheet.templates.cinquain.picture", defaultValue: "Draw your poem")
        case "thank_you": AppText("school.worksheet.templates.thank_you.picture", defaultValue: "Draw a picture for them")
        case "book_report": AppText("school.worksheet.templates.book_report.picture", defaultValue: "Draw a scene from the book")
        case "favorite_part": AppText("school.worksheet.templates.favorite_part.picture", defaultValue: "Draw your favorite part")
        case "all_about": AppText("school.worksheet.templates.all_about.picture", defaultValue: "Draw your topic")
        case "about_author": AppText("school.worksheet.templates.about_author.picture", defaultValue: "Draw yourself")
        case "feelings_checkin": AppText("school.worksheet.templates.feelings_checkin.picture", defaultValue: "Draw how you feel")
        case "all_about_me": AppText("school.worksheet.templates.all_about_me.picture", defaultValue: "Draw yourself doing something you love")
        default: nil
        }
    }

    /// The template's own prompt for a box, in the app's language: what a
    /// teacher starts editing from (and the printed label).
    static func defaultPrompt(_ templateId: String, _ boxId: String) -> LocalizedStringResource? {
        switch (templateId, boxId) {
        case ("story_map", "characters"): AppText("school.worksheet.templates.story_map.boxes.characters", defaultValue: "Who is in your story?")
        case ("story_map", "setting"): AppText("school.worksheet.templates.story_map.boxes.setting", defaultValue: "Where and when does it happen?")
        case ("story_map", "problem"): AppText("school.worksheet.templates.story_map.boxes.problem", defaultValue: "What is the problem?")
        case ("story_map", "events"): AppText("school.worksheet.templates.story_map.boxes.events", defaultValue: "What happens? Write the big moments.")
        case ("story_map", "ending"): AppText("school.worksheet.templates.story_map.boxes.ending", defaultValue: "How does it end?")
        case ("beginning_middle_end", "beginning"): AppText("school.worksheet.templates.beginning_middle_end.boxes.beginning", defaultValue: "Beginning: how does your story start?")
        case ("beginning_middle_end", "middle"): AppText("school.worksheet.templates.beginning_middle_end.boxes.middle", defaultValue: "Middle: what happens next?")
        case ("beginning_middle_end", "end"): AppText("school.worksheet.templates.beginning_middle_end.boxes.end", defaultValue: "End: how does it finish?")
        case ("sequence", "first"): AppText("school.worksheet.templates.sequence.boxes.first", defaultValue: "First…")
        case ("sequence", "next"): AppText("school.worksheet.templates.sequence.boxes.next", defaultValue: "Next…")
        case ("sequence", "then"): AppText("school.worksheet.templates.sequence.boxes.then", defaultValue: "Then…")
        case ("sequence", "last"): AppText("school.worksheet.templates.sequence.boxes.last", defaultValue: "Last…")
        case ("storyboard", "panel_one"): AppText("school.worksheet.templates.storyboard.boxes.panel_one", defaultValue: "1. How does it start?")
        case ("storyboard", "panel_two"): AppText("school.worksheet.templates.storyboard.boxes.panel_two", defaultValue: "2. What happens next?")
        case ("storyboard", "panel_three"): AppText("school.worksheet.templates.storyboard.boxes.panel_three", defaultValue: "3. And then?")
        case ("storyboard", "panel_four"): AppText("school.worksheet.templates.storyboard.boxes.panel_four", defaultValue: "4. What goes wrong?")
        case ("storyboard", "panel_five"): AppText("school.worksheet.templates.storyboard.boxes.panel_five", defaultValue: "5. How is it fixed?")
        case ("storyboard", "panel_six"): AppText("school.worksheet.templates.storyboard.boxes.panel_six", defaultValue: "6. How does it end?")
        case ("problem_solution", "problem"): AppText("school.worksheet.templates.problem_solution.boxes.problem", defaultValue: "What is the problem?")
        case ("problem_solution", "tries"): AppText("school.worksheet.templates.problem_solution.boxes.tries", defaultValue: "What do the characters try? What happens?")
        case ("problem_solution", "solution"): AppText("school.worksheet.templates.problem_solution.boxes.solution", defaultValue: "How is the problem solved?")
        case ("story_mountain", "beginning"): AppText("school.worksheet.templates.story_mountain.boxes.beginning", defaultValue: "Beginning: who, where and when?")
        case ("story_mountain", "build_up"): AppText("school.worksheet.templates.story_mountain.boxes.build_up", defaultValue: "Build-up: what starts to go wrong?")
        case ("story_mountain", "big_moment"): AppText("school.worksheet.templates.story_mountain.boxes.big_moment", defaultValue: "Big moment: what is the most exciting part?")
        case ("story_mountain", "wind_down"): AppText("school.worksheet.templates.story_mountain.boxes.wind_down", defaultValue: "Wind-down: what happens after that?")
        case ("story_mountain", "ending"): AppText("school.worksheet.templates.story_mountain.boxes.ending", defaultValue: "Ending: how does it all finish?")
        case ("character_profile", "name"): AppText("school.worksheet.templates.character_profile.boxes.name", defaultValue: "What is your character’s name?")
        case ("character_profile", "looks_like"): AppText("school.worksheet.templates.character_profile.boxes.looks_like", defaultValue: "What do they look like?")
        case ("character_profile", "likes"): AppText("school.worksheet.templates.character_profile.boxes.likes", defaultValue: "What do they like to do?")
        case ("character_profile", "wants"): AppText("school.worksheet.templates.character_profile.boxes.wants", defaultValue: "What do they want most?")
        case ("character_profile", "afraid_of"): AppText("school.worksheet.templates.character_profile.boxes.afraid_of", defaultValue: "What are they afraid of?")
        case ("setting_sketch", "place"): AppText("school.worksheet.templates.setting_sketch.boxes.place", defaultValue: "Where does your story happen?")
        case ("setting_sketch", "when"): AppText("school.worksheet.templates.setting_sketch.boxes.when", defaultValue: "When does it happen?")
        case ("setting_sketch", "looks_like"): AppText("school.worksheet.templates.setting_sketch.boxes.looks_like", defaultValue: "What does it look like?")
        case ("setting_sketch", "sounds_smells"): AppText("school.worksheet.templates.setting_sketch.boxes.sounds_smells", defaultValue: "What can you hear and smell there?")
        case ("five_senses", "place"): AppText("school.worksheet.templates.five_senses.boxes.place", defaultValue: "Which place are you describing?")
        case ("five_senses", "see"): AppText("school.worksheet.templates.five_senses.boxes.see", defaultValue: "What can you see?")
        case ("five_senses", "hear"): AppText("school.worksheet.templates.five_senses.boxes.hear", defaultValue: "What can you hear?")
        case ("five_senses", "smell"): AppText("school.worksheet.templates.five_senses.boxes.smell", defaultValue: "What can you smell?")
        case ("five_senses", "touch"): AppText("school.worksheet.templates.five_senses.boxes.touch", defaultValue: "What can you touch?")
        case ("five_senses", "taste"): AppText("school.worksheet.templates.five_senses.boxes.taste", defaultValue: "What can you taste?")
        case ("character_change", "character"): AppText("school.worksheet.templates.character_change.boxes.character", defaultValue: "Which character are you thinking about?")
        case ("character_change", "at_start"): AppText("school.worksheet.templates.character_change.boxes.at_start", defaultValue: "What are they like at the start?")
        case ("character_change", "what_happened"): AppText("school.worksheet.templates.character_change.boxes.what_happened", defaultValue: "What happens that changes them?")
        case ("character_change", "at_end"): AppText("school.worksheet.templates.character_change.boxes.at_end", defaultValue: "What are they like at the end?")
        case ("sentence_starters", "sentence_one"): AppText("school.worksheet.templates.sentence_starters.boxes.sentence_one", defaultValue: "Once upon a time…")
        case ("sentence_starters", "sentence_two"): AppText("school.worksheet.templates.sentence_starters.boxes.sentence_two", defaultValue: "One day…")
        case ("sentence_starters", "sentence_three"): AppText("school.worksheet.templates.sentence_starters.boxes.sentence_three", defaultValue: "Suddenly…")
        case ("sentence_starters", "sentence_four"): AppText("school.worksheet.templates.sentence_starters.boxes.sentence_four", defaultValue: "In the end…")
        case ("describing_words", "thing"): AppText("school.worksheet.templates.describing_words.boxes.thing", defaultValue: "What are you describing?")
        case ("describing_words", "word_one"): AppText("school.worksheet.templates.describing_words.boxes.word_one", defaultValue: "How does it look?")
        case ("describing_words", "word_two"): AppText("school.worksheet.templates.describing_words.boxes.word_two", defaultValue: "How big is it?")
        case ("describing_words", "word_three"): AppText("school.worksheet.templates.describing_words.boxes.word_three", defaultValue: "How does it feel?")
        case ("describing_words", "word_four"): AppText("school.worksheet.templates.describing_words.boxes.word_four", defaultValue: "What color is it?")
        case ("describing_words", "word_five"): AppText("school.worksheet.templates.describing_words.boxes.word_five", defaultValue: "One more word!")
        case ("word_web", "center"): AppText("school.worksheet.templates.word_web.boxes.center", defaultValue: "What is your big idea?")
        case ("word_web", "idea_one"): AppText("school.worksheet.templates.word_web.boxes.idea_one", defaultValue: "First idea")
        case ("word_web", "idea_two"): AppText("school.worksheet.templates.word_web.boxes.idea_two", defaultValue: "Second idea")
        case ("word_web", "idea_three"): AppText("school.worksheet.templates.word_web.boxes.idea_three", defaultValue: "Third idea")
        case ("word_web", "idea_four"): AppText("school.worksheet.templates.word_web.boxes.idea_four", defaultValue: "Fourth idea")
        case ("word_web", "idea_five"): AppText("school.worksheet.templates.word_web.boxes.idea_five", defaultValue: "Fifth idea")
        case ("word_web", "idea_six"): AppText("school.worksheet.templates.word_web.boxes.idea_six", defaultValue: "Sixth idea")
        case ("stretch_sentence", "who"): AppText("school.worksheet.templates.stretch_sentence.boxes.who", defaultValue: "Who?")
        case ("stretch_sentence", "did_what"): AppText("school.worksheet.templates.stretch_sentence.boxes.did_what", defaultValue: "Did what?")
        case ("stretch_sentence", "where"): AppText("school.worksheet.templates.stretch_sentence.boxes.where", defaultValue: "Where?")
        case ("stretch_sentence", "when"): AppText("school.worksheet.templates.stretch_sentence.boxes.when", defaultValue: "When?")
        case ("stretch_sentence", "why"): AppText("school.worksheet.templates.stretch_sentence.boxes.why", defaultValue: "Why?")
        case ("stretch_sentence", "my_sentence"): AppText("school.worksheet.templates.stretch_sentence.boxes.my_sentence", defaultValue: "Now put it all together in one long sentence.")
        case ("dialogue", "character_a"): AppText("school.worksheet.templates.dialogue.boxes.character_a", defaultValue: "Who is the first character?")
        case ("dialogue", "character_b"): AppText("school.worksheet.templates.dialogue.boxes.character_b", defaultValue: "Who is the second character?")
        case ("dialogue", "conversation"): AppText("school.worksheet.templates.dialogue.boxes.conversation", defaultValue: "Write what they say to each other. Use quotation marks.")
        case ("acrostic", "word"): AppText("school.worksheet.templates.acrostic.boxes.word", defaultValue: "Choose a word. Each letter starts a line.")
        case ("acrostic", "lines"): AppText("school.worksheet.templates.acrostic.boxes.lines", defaultValue: "Write a word or a line for each letter.")
        case ("haiku", "line_one"): AppText("school.worksheet.templates.haiku.boxes.line_one", defaultValue: "Line 1: 5 syllables")
        case ("haiku", "line_two"): AppText("school.worksheet.templates.haiku.boxes.line_two", defaultValue: "Line 2: 7 syllables")
        case ("haiku", "line_three"): AppText("school.worksheet.templates.haiku.boxes.line_three", defaultValue: "Line 3: 5 syllables")
        case ("i_am_poem", "i_am"): AppText("school.worksheet.templates.i_am_poem.boxes.i_am", defaultValue: "I am…")
        case ("i_am_poem", "i_wonder"): AppText("school.worksheet.templates.i_am_poem.boxes.i_wonder", defaultValue: "I wonder…")
        case ("i_am_poem", "i_hear"): AppText("school.worksheet.templates.i_am_poem.boxes.i_hear", defaultValue: "I hear…")
        case ("i_am_poem", "i_see"): AppText("school.worksheet.templates.i_am_poem.boxes.i_see", defaultValue: "I see…")
        case ("i_am_poem", "i_want"): AppText("school.worksheet.templates.i_am_poem.boxes.i_want", defaultValue: "I want…")
        case ("i_am_poem", "i_am_again"): AppText("school.worksheet.templates.i_am_poem.boxes.i_am_again", defaultValue: "I am… (say it again)")
        case ("cinquain", "noun"): AppText("school.worksheet.templates.cinquain.boxes.noun", defaultValue: "Line 1: one noun (your topic)")
        case ("cinquain", "two_describing"): AppText("school.worksheet.templates.cinquain.boxes.two_describing", defaultValue: "Line 2: two describing words")
        case ("cinquain", "three_doing"): AppText("school.worksheet.templates.cinquain.boxes.three_doing", defaultValue: "Line 3: three action words")
        case ("cinquain", "feeling_phrase"): AppText("school.worksheet.templates.cinquain.boxes.feeling_phrase", defaultValue: "Line 4: a short phrase about a feeling")
        case ("cinquain", "another_name"): AppText("school.worksheet.templates.cinquain.boxes.another_name", defaultValue: "Line 5: another word for your topic")
        case ("opinion", "opinion"): AppText("school.worksheet.templates.opinion.boxes.opinion", defaultValue: "O — Opinion: what do you think?")
        case ("opinion", "reason"): AppText("school.worksheet.templates.opinion.boxes.reason", defaultValue: "R — Reason: why do you think so?")
        case ("opinion", "example"): AppText("school.worksheet.templates.opinion.boxes.example", defaultValue: "E — Example: give an example.")
        case ("opinion", "conclusion"): AppText("school.worksheet.templates.opinion.boxes.conclusion", defaultValue: "O — Opinion again: say it one more time.")
        case ("letter", "greeting"): AppText("school.worksheet.templates.letter.boxes.greeting", defaultValue: "Who are you writing to?")
        case ("letter", "opening"): AppText("school.worksheet.templates.letter.boxes.opening", defaultValue: "Say hello and why you are writing.")
        case ("letter", "body"): AppText("school.worksheet.templates.letter.boxes.body", defaultValue: "What do you want to tell or ask?")
        case ("letter", "closing"): AppText("school.worksheet.templates.letter.boxes.closing", defaultValue: "How do you end your letter?")
        case ("letter", "signature"): AppText("school.worksheet.templates.letter.boxes.signature", defaultValue: "Sign your name.")
        case ("thank_you", "to"): AppText("school.worksheet.templates.thank_you.boxes.to", defaultValue: "Who is it for?")
        case ("thank_you", "thank_you_for"): AppText("school.worksheet.templates.thank_you.boxes.thank_you_for", defaultValue: "Thank you for…")
        case ("thank_you", "because"): AppText("school.worksheet.templates.thank_you.boxes.because", defaultValue: "It made me feel… because…")
        case ("thank_you", "from"): AppText("school.worksheet.templates.thank_you.boxes.from", defaultValue: "From: sign your name.")
        case ("persuade", "should"): AppText("school.worksheet.templates.persuade.boxes.should", defaultValue: "What do you think should happen?")
        case ("persuade", "reason_one"): AppText("school.worksheet.templates.persuade.boxes.reason_one", defaultValue: "My first reason is…")
        case ("persuade", "reason_two"): AppText("school.worksheet.templates.persuade.boxes.reason_two", defaultValue: "Another reason is…")
        case ("persuade", "reason_three"): AppText("school.worksheet.templates.persuade.boxes.reason_three", defaultValue: "My best reason is…")
        case ("persuade", "so"): AppText("school.worksheet.templates.persuade.boxes.so", defaultValue: "So… (say again what should happen)")
        case ("book_report", "title"): AppText("school.worksheet.templates.book_report.boxes.title", defaultValue: "What is the book called?")
        case ("book_report", "author"): AppText("school.worksheet.templates.book_report.boxes.author", defaultValue: "Who wrote it?")
        case ("book_report", "about"): AppText("school.worksheet.templates.book_report.boxes.about", defaultValue: "What is the book about?")
        case ("book_report", "favorite"): AppText("school.worksheet.templates.book_report.boxes.favorite", defaultValue: "What was your favorite part?")
        case ("book_report", "would_recommend"): AppText("school.worksheet.templates.book_report.boxes.would_recommend", defaultValue: "Would you tell someone to read it? Why?")
        case ("favorite_part", "title"): AppText("school.worksheet.templates.favorite_part.boxes.title", defaultValue: "What book did you read?")
        case ("favorite_part", "part"): AppText("school.worksheet.templates.favorite_part.boxes.part", defaultValue: "What happens in your favorite part?")
        case ("favorite_part", "why"): AppText("school.worksheet.templates.favorite_part.boxes.why", defaultValue: "Why do you like it?")
        case ("predict", "title"): AppText("school.worksheet.templates.predict.boxes.title", defaultValue: "What are you reading?")
        case ("predict", "clues"): AppText("school.worksheet.templates.predict.boxes.clues", defaultValue: "What clues do you notice?")
        case ("predict", "prediction"): AppText("school.worksheet.templates.predict.boxes.prediction", defaultValue: "What do you think will happen?")
        case ("predict", "what_happened"): AppText("school.worksheet.templates.predict.boxes.what_happened", defaultValue: "What really happened? Were you right?")
        case ("compare_books", "book_one"): AppText("school.worksheet.templates.compare_books.boxes.book_one", defaultValue: "First book:")
        case ("compare_books", "book_two"): AppText("school.worksheet.templates.compare_books.boxes.book_two", defaultValue: "Second book:")
        case ("compare_books", "same"): AppText("school.worksheet.templates.compare_books.boxes.same", defaultValue: "How are they the same?")
        case ("compare_books", "different"): AppText("school.worksheet.templates.compare_books.boxes.different", defaultValue: "How are they different?")
        case ("all_about", "topic"): AppText("school.worksheet.templates.all_about.boxes.topic", defaultValue: "What is your topic?")
        case ("all_about", "fact_one"): AppText("school.worksheet.templates.all_about.boxes.fact_one", defaultValue: "One fact is…")
        case ("all_about", "fact_two"): AppText("school.worksheet.templates.all_about.boxes.fact_two", defaultValue: "Another fact is…")
        case ("all_about", "fact_three"): AppText("school.worksheet.templates.all_about.boxes.fact_three", defaultValue: "One more fact…")
        case ("all_about", "wow_fact"): AppText("school.worksheet.templates.all_about.boxes.wow_fact", defaultValue: "Wow! Did you know…?")
        case ("how_to", "what"): AppText("school.worksheet.templates.how_to.boxes.what", defaultValue: "What are you teaching?")
        case ("how_to", "need"): AppText("school.worksheet.templates.how_to.boxes.need", defaultValue: "What do you need?")
        case ("how_to", "step_one"): AppText("school.worksheet.templates.how_to.boxes.step_one", defaultValue: "Step 1:")
        case ("how_to", "step_two"): AppText("school.worksheet.templates.how_to.boxes.step_two", defaultValue: "Step 2:")
        case ("how_to", "step_three"): AppText("school.worksheet.templates.how_to.boxes.step_three", defaultValue: "Step 3:")
        case ("how_to", "step_four"): AppText("school.worksheet.templates.how_to.boxes.step_four", defaultValue: "Step 4:")
        case ("about_author", "my_name"): AppText("school.worksheet.templates.about_author.boxes.my_name", defaultValue: "My name is…")
        case ("about_author", "i_like"): AppText("school.worksheet.templates.about_author.boxes.i_like", defaultValue: "I like…")
        case ("about_author", "i_write_about"): AppText("school.worksheet.templates.about_author.boxes.i_write_about", defaultValue: "I like to write about…")
        case ("about_author", "fun_fact"): AppText("school.worksheet.templates.about_author.boxes.fun_fact", defaultValue: "A fun fact about me…")
        case ("feelings_checkin", "feeling"): AppText("school.worksheet.templates.feelings_checkin.boxes.feeling", defaultValue: "How do you feel today?")
        case ("feelings_checkin", "why"): AppText("school.worksheet.templates.feelings_checkin.boxes.why", defaultValue: "Why do you feel this way?")
        case ("feelings_checkin", "what_helps"): AppText("school.worksheet.templates.feelings_checkin.boxes.what_helps", defaultValue: "What would help you?")
        case ("my_week", "best"): AppText("school.worksheet.templates.my_week.boxes.best", defaultValue: "The best part of my week was…")
        case ("my_week", "learned"): AppText("school.worksheet.templates.my_week.boxes.learned", defaultValue: "Something new I learned…")
        case ("my_week", "tricky"): AppText("school.worksheet.templates.my_week.boxes.tricky", defaultValue: "Something tricky was…")
        case ("my_week", "felt_good"): AppText("school.worksheet.templates.my_week.boxes.felt_good", defaultValue: "Something that made me feel good…")
        case ("my_week", "next_week"): AppText("school.worksheet.templates.my_week.boxes.next_week", defaultValue: "Next week I want to…")
        case ("all_about_me", "favorites"): AppText("school.worksheet.templates.all_about_me.boxes.favorites", defaultValue: "My favorite things are…")
        case ("all_about_me", "good_at"): AppText("school.worksheet.templates.all_about_me.boxes.good_at", defaultValue: "I am good at…")
        case ("all_about_me", "learning"): AppText("school.worksheet.templates.all_about_me.boxes.learning", defaultValue: "I am learning to…")
        case ("all_about_me", "dream"): AppText("school.worksheet.templates.all_about_me.boxes.dream", defaultValue: "One day I want to…")
        default: nil
        }
    }

    // MARK: library

    static func category(_ category: WorksheetTemplate.Category) -> LocalizedStringResource {
        switch category {
        case .plan: AppText("school.worksheet.categories.plan", defaultValue: "Plan a story")
        case .characters: AppText("school.worksheet.categories.characters", defaultValue: "Characters & places")
        case .words: AppText("school.worksheet.categories.words", defaultValue: "Words & sentences")
        case .poems: AppText("school.worksheet.categories.poems", defaultValue: "Poems")
        case .opinions: AppText("school.worksheet.categories.opinions", defaultValue: "Opinions & letters")
        case .reading: AppText("school.worksheet.categories.reading", defaultValue: "Reading response")
        case .facts: AppText("school.worksheet.categories.facts", defaultValue: "Facts & how-to")
        case .me: AppText("school.worksheet.categories.me", defaultValue: "About me & feelings")
        }
    }

    static func grade(_ grade: WorksheetTemplate.GradeBand) -> LocalizedStringResource {
        switch grade {
        case .k2: AppText("school.worksheet.grades.k2", defaultValue: "Grades K–2")
        case .g35: AppText("school.worksheet.grades.g35", defaultValue: "Grades 3–5")
        case .all: AppText("school.worksheet.grades.all", defaultValue: "Grades K–5")
        }
    }

    static var librarySearchLabel: LocalizedStringResource { AppText("school.worksheet.library.search_label", defaultValue: "Search worksheets") }
    static var librarySearchPlaceholder: LocalizedStringResource { AppText("school.worksheet.library.search_placeholder", defaultValue: "Search: poem, letter, feelings…") }
    static var libraryCategoryLabel: LocalizedStringResource { AppText("school.worksheet.library.category_label", defaultValue: "Category") }
    static var libraryAllCategories: LocalizedStringResource { AppText("school.worksheet.library.all_categories", defaultValue: "All") }
    static var libraryGradeLabel: LocalizedStringResource { AppText("school.worksheet.library.grade_label", defaultValue: "Grade") }
    static var libraryAllGrades: LocalizedStringResource { AppText("school.worksheet.library.all_grades", defaultValue: "All grades") }
    static func libraryNoResults(_ query: String) -> LocalizedStringResource { AppText("school.worksheet.library.no_results", defaultValue: "No worksheet matches “\(query)”.") }
    static var libraryNoResultsFilters: LocalizedStringResource { AppText("school.worksheet.library.no_results_filters", defaultValue: "No worksheet matches these filters.") }
    static var libraryClearSearch: LocalizedStringResource { AppText("school.worksheet.library.clear_search", defaultValue: "Clear search") }
    static var libraryShowAll: LocalizedStringResource { AppText("school.worksheet.library.show_all", defaultValue: "Show all worksheets") }
    static var libraryView: LocalizedStringResource { AppText("school.worksheet.library.view", defaultValue: "View") }
    static var libraryPrevious: LocalizedStringResource { AppText("school.worksheet.library.previous", defaultValue: "Previous worksheet") }
    static var libraryNext: LocalizedStringResource { AppText("school.worksheet.library.next", defaultValue: "Next worksheet") }
    static var libraryClosePreview: LocalizedStringResource { AppText("school.worksheet.library.close_preview", defaultValue: "Close preview") }
    static var libraryAssign: LocalizedStringResource { AppText("school.worksheet.library.assign", defaultValue: "Assign to my class") }
    // MARK: teacher

    static var teacherKindLabel: LocalizedStringResource { AppText("school.worksheet.teacher.kind_label", defaultValue: "What are you assigning?") }
    static var teacherKindBook: LocalizedStringResource { AppText("school.worksheet.teacher.kind_book", defaultValue: "A book") }
    static var teacherKindBookHint: LocalizedStringResource { AppText("school.worksheet.teacher.kind_book_hint", defaultValue: "Each child writes a book of their own.") }
    static var teacherKindWorksheet: LocalizedStringResource { AppText("school.worksheet.teacher.kind_worksheet", defaultValue: "A worksheet") }
    static var teacherKindWorksheetHint: LocalizedStringResource { AppText("school.worksheet.teacher.kind_worksheet_hint", defaultValue: "Boxes to fill in, from a template.") }
    static var teacherChooseTemplate: LocalizedStringResource { AppText("school.worksheet.teacher.choose_template", defaultValue: "Choose a worksheet") }
    static var teacherChangeTemplate: LocalizedStringResource { AppText("school.worksheet.teacher.change_template", defaultValue: "Change worksheet") }
    static var teacherInstructionsLabel: LocalizedStringResource { AppText("school.worksheet.teacher.instructions_label", defaultValue: "Instructions for the class") }
    static var teacherPromptsHeading: LocalizedStringResource { AppText("school.worksheet.teacher.prompts_heading", defaultValue: "The prompt in each box") }
    static var teacherPromptsHint: LocalizedStringResource { AppText("school.worksheet.teacher.prompts_hint", defaultValue: "Edit any prompt to fit your class.") }
    static var teacherResetPrompts: LocalizedStringResource { AppText("school.worksheet.teacher.reset_prompts", defaultValue: "Reset prompts") }
    static func teacherBoxLabel(_ number: Int) -> LocalizedStringResource { AppText("school.worksheet.teacher.box_label", defaultValue: "Box \(number)") }
    static var teacherAcrosticWordLabel: LocalizedStringResource { AppText("school.worksheet.teacher.acrostic_word_label", defaultValue: "Word for the acrostic (optional)") }
    static var teacherAcrosticWordHint: LocalizedStringResource { AppText("school.worksheet.teacher.acrostic_word_hint", defaultValue: "Leave it empty and each child chooses a word.") }
    static var teacherAcrosticWordInvalid: LocalizedStringResource { AppText("school.worksheet.teacher.acrostic_word_invalid", defaultValue: "Use 2–12 letters, no spaces.") }
    static var teacherPromptRequired: LocalizedStringResource { AppText("school.worksheet.teacher.prompt_required", defaultValue: "Every box needs a prompt.") }
    static var teacherTemplateRequired: LocalizedStringResource { AppText("school.worksheet.teacher.template_required", defaultValue: "Choose a worksheet.") }
    static var teacherChip: LocalizedStringResource { AppText("school.worksheet.teacher.chip", defaultValue: "Worksheet") }
    static var teacherPrintBlank: LocalizedStringResource { AppText("school.worksheet.teacher.print_blank", defaultValue: "Print blank") }
    static var teacherPrintFilled: LocalizedStringResource { AppText("school.worksheet.teacher.print_filled", defaultValue: "Print") }
    static var teacherAnswersHeading: LocalizedStringResource { AppText("school.worksheet.teacher.answers_heading", defaultValue: "Answers") }
    static var teacherNoAnswer: LocalizedStringResource { AppText("school.worksheet.teacher.no_answer", defaultValue: "(empty)") }
    static var teacherAcrosticWordLocked: LocalizedStringResource { AppText("school.worksheet.teacher.acrostic_word_locked", defaultValue: "Locked after publishing: children may already be writing to this word.") }
    // Live preview in the assign form (web twins: AssignPreview / AssignmentForm).
    static var teacherPreviewEdit: LocalizedStringResource { AppText("school.worksheet.teacher.preview_edit", defaultValue: "Edit") }
    static var teacherPreviewTab: LocalizedStringResource { AppText("school.worksheet.teacher.preview_tab", defaultValue: "Preview") }
    static var teacherPreviewHeading: LocalizedStringResource { AppText("school.worksheet.teacher.preview_heading", defaultValue: "What the class will see") }
    static var teacherPreviewHint: LocalizedStringResource { AppText("school.worksheet.teacher.preview_hint", defaultValue: "Updates as you type.") }
    static var teacherPreviewScreen: LocalizedStringResource { AppText("school.worksheet.teacher.preview_screen", defaultValue: "On screen") }
    static var teacherPreviewPaper: LocalizedStringResource { AppText("school.worksheet.teacher.preview_paper", defaultValue: "Printed") }
    // MARK: student

    static var studentStart: LocalizedStringResource { AppText("school.worksheet.student.start", defaultValue: "Start worksheet") }
    static var studentContinue: LocalizedStringResource { AppText("school.worksheet.student.continue", defaultValue: "Continue worksheet") }
    static var studentOpen: LocalizedStringResource { AppText("school.worksheet.student.open", defaultValue: "Open my worksheet") }
    static var studentHandIn: LocalizedStringResource { AppText("school.worksheet.student.hand_in", defaultValue: "Hand in") }
    static var studentHandingIn: LocalizedStringResource { AppText("school.worksheet.student.handing_in", defaultValue: "Handing in…") }
    static var studentSavedHere: LocalizedStringResource { AppText("school.worksheet.student.saved_here", defaultValue: "Saved on this device") }
    static var studentListen: LocalizedStringResource { AppText("school.worksheet.student.listen", defaultValue: "Read the question out loud") }
    static var studentDictate: LocalizedStringResource { AppText("school.worksheet.student.dictate", defaultValue: "Say it instead of typing") }
    static var studentStopDictate: LocalizedStringResource { AppText("school.worksheet.student.stop_dictate", defaultValue: "Stop listening") }
    static var studentWordLabel: LocalizedStringResource { AppText("school.worksheet.student.word_label", defaultValue: "My word") }
    static var studentWordPlaceholder: LocalizedStringResource { AppText("school.worksheet.student.word_placeholder", defaultValue: "Type your word") }
    static func studentLineFor(_ letter: String) -> LocalizedStringResource { AppText("school.worksheet.student.line_for", defaultValue: "Line for \(letter)") }
    static var studentClose: LocalizedStringResource { AppText("school.worksheet.student.close", defaultValue: "Close worksheet") }
    static var studentMakePages: LocalizedStringResource { AppText("school.worksheet.student.make_pages", defaultValue: "Turn into book pages") }
    static var studentMakePagesHeading: LocalizedStringResource { AppText("school.worksheet.student.make_pages_heading", defaultValue: "Make book pages") }
    static var studentMakePagesHint: LocalizedStringResource { AppText("school.worksheet.student.make_pages_hint", defaultValue: "Your answers become pages you can keep writing.") }
    static var studentMakePagesNew: LocalizedStringResource { AppText("school.worksheet.student.make_pages_new", defaultValue: "Start a new book") }
    static var studentMakePagesAppend: LocalizedStringResource { AppText("school.worksheet.student.make_pages_append", defaultValue: "Add to one of my books") }
    static var studentMakePagesFull: LocalizedStringResource { AppText("school.worksheet.student.make_pages_full", defaultValue: "This book is full.") }
    static var studentBoxFull: LocalizedStringResource { AppText("school.worksheet.student.box_full", defaultValue: "This box is full.") }
}
