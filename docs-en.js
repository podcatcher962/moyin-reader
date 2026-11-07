/* MoYin Reader · English documentation pages
   Loaded after i18n.js; consumed by showDoc() in app.js. */
(function (w) {
  'use strict';

  w.MYDOCS_EN = {

    help: '<h3>Import</h3>' +
      '<p>Tap <b>＋ Import</b> on the shelf to add one or more <code>.txt</code> / <code>.epub</code> files, or <b>Folder</b> to pull every TXT / EPUB out of a directory at once. Everything is stored in this device’s browser database — nothing is uploaded.</p>' +
      '<h3>Reading</h3><ul>' +
      '<li><b>Contents</b> jumps between chapters, <b>Search</b> scans the whole book, <b>+ Mark</b> drops a bookmark where you are.</li>' +
      '<li>Drag the bottom slider to move anywhere in the book. Arrow keys change chapter, space scrolls a screen.</li>' +
      '<li>Shortcuts: ← / → chapter (pages when paged), space scroll (or pause / resume while listening), Ctrl + F search, Esc back to the shelf or close a dialog.</li>' +
      '<li><b>Type</b> collects it all: scroll or paged, columns, turn animation, size, line height, paragraph gap, letter spacing, indent, typeface, alignment, measure width, side margins, six themes with custom paper and text colour, brightness, and auto-read speed.</li>' +
      '<li><b>Theme</b> cycles the six palettes; <b>Auto</b> toggles auto reading; <b>Full</b> goes immersive.</li>' +
      '<li>Your position is saved automatically, and listening position is tracked separately.</li></ul>' +
      '<h3>Highlights, notes and sharing</h3>' +
      '<p>Select any sentence in the text and a small toolbar appears: pick one of four highlight colours, attach a note, copy the text, or turn it into a share card (PNG). Open <b>Notes</b> in the side panel to browse every highlight in the book, jump back to it, edit the note or delete it. From there you can also export all notes as Markdown, or open <b>Reading summary</b> to see how much you have read and to export the excerpts.</p>' +
      '<h3>Shelves and favorites</h3>' +
      '<p>The chip bar under the header groups books: <i>All</i>, <i>★ Favorites</i> and any shelves you create with <b>Shelves</b>. Each book has a ☆ button (favorite) and a ⋯ menu (edit title / author, move to a shelf, remove). Tap <b>Select</b> in that menu — or long-press on touch — to batch-move or batch-remove books.</p>' +
      '<h3>Reading aloud</h3>' +
      '<p><b>Read aloud</b> starts from the paragraph at the top of the screen. The bar lets you change voice, speed, skip paragraphs and set a sleep timer; the current paragraph is highlighted and scrolls into view, and the next chapter continues automatically.</p>' +
      '<p><b>Resume listening</b>: listening position is remembered separately from reading position. Back on the shelf, the card shows “▶ Resume · ch. N” — tap it to continue from the exact paragraph. Switching voices mid-sentence restarts the current paragraph with the new voice.</p>' +
      '<p>Reading works out of the box with system voices. For near-human Chinese, see <b>Settings → Free neural voices</b>: an open-source engine and model ship with the app (174 Chinese speakers), completely offline, free, no account. Otherwise the voice list is grouped as natural / online / local and picks the best available.</p>' +
      '<h3>Backup</h3><p><b>Back up</b> writes progress, bookmarks, highlights, notes and settings to a JSON file; tick “include book files” to carry the books themselves. Restore on another device with <b>Restore</b>.</p>',

    voice: '<h3>Why voices can sound robotic</h3>' +
      '<p class="kv">Want natural Chinese quickly? See <b>Settings → Free neural voices</b>: install the open-source voice library once and it works offline forever, free of charge.</p>' +
      '<p>Browser speech uses the operating system engine. The built-in Windows voices (Huihui / Kangkang / Yaoyao) are old concatenative synthesis — flat pitch, hard pauses, robot-like. Voices named <code>Online (Natural)</code> are neural: they handle intonation, stress and sentence-final falls, and sound close to a human.</p>' +
      '<h3>Three options</h3><ul>' +
      '<li><b>⭐ Free offline neural voices (recommended)</b>: sherpa-onnx plus the open-source AISHELL3 multi-speaker VITS model, running on your own CPU. Near-human intonation, <b>no network, no fees, no account, no API key</b>. The model holds 174 Chinese speakers (148 female + 26 male); 11 curated voices are listed by default and role-based reading is supported. Double-click the launcher before listening.</li>' +
      '<li><b>⭐ Natural voices</b>: names containing <code>Natural</code> / <code>Neural</code>, provided by Microsoft Edge. Good quality but <b>needs a connection</b>, and the service is often unreachable from mainland China.</li>' +
      '<li><b>Local voices</b>: fully offline and instant, but clearly mechanical. Use as a fallback.</li></ul>' +
      '<p>The voice list is grouped accordingly and the badge next to it shows “● Free neural voices” or “● Local voice (robotic)”. <b>Preview</b> compares voices without touching your reading position.</p>' +
      '<h3>No natural voices listed?</h3><ol>' +
      '<li><b>Open this file in Microsoft Edge</b> (right-click → Open with). Chrome’s Chinese online voices depend on Google services, which are usually unreachable here.</li>' +
      '<li>In Edge → Settings → Languages, make sure “Chinese (Simplified)” is present. In Windows → Settings → Time &amp; language → Language &amp; region → Chinese (Simplified) → Language options → Speech, download the speech pack, then restart Edge.</li>' +
      '<li>Or skip all of this and use the free offline library, which depends on no online service.</li></ol>' +
      '<h3>Three knobs for more natural speech</h3><ul>' +
      '<li><b>Whole sentences</b> (on by default): split at sentence boundaries instead of mid-clause, so neural voices keep their prosody.</li>' +
      '<li><b>Pause between sentences</b> (120 ms by default): a little silence between sentences, doubled between paragraphs. Adjustable 0–600 ms in Settings → Reading aloud.</li>' +
      '<li><b>Speed 0.9–1.1×</b>: the comfortable range for Chinese; faster eats the expression, slower drags.</li></ul>' +
      '<h3>Privacy</h3><p>With the offline library or local system voices, speech is produced entirely on this machine — <b>no outbound requests at all</b>, not a single character leaves your computer. Only when you deliberately pick an <code>Online (Natural)</code> voice does the browser send the sentence being spoken to Microsoft for synthesis; that is the browser engine’s behaviour, and this app uploads no books, progress or settings.</p>' +
      '<p>If an online voice fails, the app falls back to a local voice and tells you, never hanging. Voice availability and quality vary by device and installed language packs.</p>' +
      '<h3>Preview silent or falling back?</h3>' +
      '<p>Online neural voices need <code>speech.platform.bing.com</code>. That domain is blocked or throttled on some networks (mainland China additionally requires a short-lived token), which shows up as silence. It is neither the book nor this app — the offline library sidesteps it completely.</p><ul>' +
      '<li>Route <code>speech.platform.bing.com</code> through a working proxy / accelerator (global mode), then hit <b>Preview</b>.</li>' +
      '<li>Try another network (a phone hotspot, for example) or another time of day.</li>' +
      '<li>Or stop fighting the network and use <b>Free neural voices</b>, which work offline forever.</li></ul>',

    local: '<h3>What this is</h3>' +
      '<p>A <b>completely free, completely offline</b> Chinese neural speech option: the open-source <code>sherpa-onnx</code> engine (Apache-2.0) plus the open-source Chinese multi-speaker VITS model <code>AISHELL3</code>. Intonation, pauses and stress are close to a human — a different league from the built-in Windows voices.</p>' +
      '<p>Synthesis runs <b>on your own computer</b>: no sign-up, no API key, no network, no per-character billing, not one byte of the book is sent anywhere.</p>' +
      '<h3>Two steps to listen</h3><ol>' +
      '<li>Open the bundled <code>VoicePack</code> folder and double-click <code>启动语音引擎.cmd</code> (the launcher). It starts a small local service and opens the reader in Edge. <b>Nothing to download, install or fill in.</b> The English-named <code>START.cmd</code> in the same folder runs the same script.</li>' +
      '<li>When the badge in the reading bar turns green — “● Free neural voices” — it is connected. Hit <b>Preview voice</b> to confirm sound. Closing that window stops the service and the app falls back to system voices; reading is unaffected.</li></ol>' +
      '<p class="kv">Moving to another computer: copy the whole <code>VoicePack</code> folder (engine and model already inside, about 53 MB). If you only copy the scripts, run <code>安装语音包.cmd</code> on the new machine to download the same files (about 53 MB, from a China-friendly mirror, chunked and parallel). The Windows voice library cannot be reused on other systems. <b>The full Windows EXE has the library appended inside the executable</b>: copy that single file (about 47 MB) and you can listen immediately; it unpacks to the local cache on first run.</p>' +
      '<h3>Built-in voices · 174 Chinese speakers (148 female + 26 male)</h3>' +
      '<p>One model contains 174 different Chinese speakers. The dropdown lists the <b>11 hand-picked, named</b> voices by default; to hear more, open <b>Settings → Free neural voices → Voice range</b> and choose “All 174”. The list is then sorted into seven pitch bands (low / mid / bright male; low / mid / clear / high female). Use <b>Preview voice</b> to compare, or switch directly from the dropdown at the left of the reading bar — while reading, the current paragraph restarts with the new voice. Everything is offline neural speech and real-time on an ordinary CPU.</p>' +
      '<p><b>Why 174 voices cost no space</b>: they all come from the same 29 MB AISHELL3 multi-speaker model — switching only changes a <code>--sid</code> index. The official model ships numbers without nicknames; the “low / clear / bright” labels come from each speaker’s measured median pitch (F0) and exist only to help you tell them apart. <b>Preview and pick the one you like.</b></p>' +
      '<p class="kv">For long novels the default “Voice 12” (warm, slightly low) is a good start; try “Voice 160” or “Voice 150” for something brighter, “Voice 110” for a male voice. Synthesis is fast (about one second for a 4–7 second sentence). Only installed voices are listed; missing files are hidden automatically.</p>' +
      '<h3>Role-based reading (a different voice per character)</h3>' +
      '<p>Turn on <b>Multi-voice</b> in the reading bar, or in <b>Settings → Multi-voice dialogue</b>: <b>narration keeps your chosen voice, while quoted dialogue switches per character</b>. Each character keeps the same voice for the whole book, and different characters never collide; when a name cannot be recognised, voices rotate in order of appearance so dialogue never merges into the narration.</p>' +
      '<p>The character voice pool can be <i>mixed</i>, <i>female only</i> or <i>male only</i>. <b>Preview</b> in settings reads a short passage with dialogue so you can hear the difference immediately. Toggling while reading takes effect at once and restarts the current paragraph.</p>' +
      '<p class="kv">Works only with the free neural voices — a system voice can only produce one voice at a time. The narration voice is whatever you selected; to change the most frequent character, change the narration voice (the character pool automatically avoids it).</p>' +
      '<h3>How it works</h3>' +
      '<p>The launcher starts an HTTP service on <code>127.0.0.1</code> (Python standard library only, no third-party dependencies). The reader sends <b>the sentence being spoken</b>, the service renders a WAV and returns it for playback, and the next sentence is prefetched so playback feels gapless. The service never listens on external interfaces, writes no logs and collects nothing.</p>' +
      '<p><code>VoicePack</code> is self-contained: <code>tts_server.py</code> uses only the standard library, and <code>安装语音包.cmd</code> downloads open-source files from their official release pages only when you run it. It touches no registry, installs no system component and starts nothing at boot; deleting the whole folder does not affect the reader.</p>' +
      '<h3>Not connecting / no sound</h3><ul>' +
      '<li>Badge stuck at “● Local voice”: the engine is not running. Double-click the launcher, then hit <b>Recheck</b> in Settings.</li>' +
      '<li>Port already in use: change the port in Settings; keep the launcher and the reader consistent.</li>' +
      '<li>Missing model: run <code>安装语音包.cmd</code> again and wait for it to finish.</li>' +
      '<li>A 1–2 second delay on the first sentence is the model loading; later sentences are much faster. On older machines, reduce the pause between sentences.</li>' +
      '<li>Any failure falls back to system voices automatically — nothing hangs, no progress is lost.</li></ul>' +
      '<h3>License</h3><p><code>sherpa-onnx</code> (Apache-2.0) and the <code>AISHELL3</code> Chinese multi-speaker VITS model are open-source projects used under their own licenses. They are bundled only to be called locally; this reader does not modify them, install system components or redistribute them over the network.</p>',

    faq: '<h3>Reading sounds robotic?</h3><p>Use the free offline voice library that ships with the app: double-click <code>VoicePack/启动语音引擎.cmd</code> — nothing to download, fully offline, free, no account. See <b>Free neural voices</b>. You can also open the file in Microsoft Edge and pick a voice from the “⭐ Natural voices” group.</p>' +
      '<h3>Does it cost money? Do I need an account?</h3><p>No and no. The reader, the offline engine and the Chinese model are all free and open source — no account, no key, no metering, and no text is uploaded. Only the Windows / Edge online voices are a Microsoft service: free of charge, but often unreachable in mainland China.</p>' +
      '<h3>TXT opens as garbage characters?</h3><p>UTF-8 / GB18030 / UTF-16 are detected automatically. If it still looks wrong, set <b>Settings → TXT encoding</b> manually (GB18030 / Big5 / UTF-16LE) and reopen the book.</p>' +
      '<h3>No sound, or Chinese read as English?</h3><p>Windows: Settings → Time &amp; language → Speech → add a Chinese (Simplified) voice pack, then restart the browser. In the voice dropdown pick an entry starting with <code>zh-CN</code>. Some Android WebViews ship without a speech engine and need a system TTS installed.</p>' +
      '<h3>EPUB fails to open?</h3><p>Standard EPUB 2 / EPUB 3 (ZIP + OPF + spine) is supported. DRM-protected files and Amazon AZW3 / MOBI are out of scope. For very old books with non-standard internal paths, the parser is tolerant about case and encoding.</p>' +
      '<h3>Cleared browser data and lost my books?</h3><p>Data lives in IndexedDB; clearing site data deletes it. <b>Back up</b> first, and keep the original files.</p>' +
      '<h3>How do I move to another computer or phone?</h3><p>Export a backup JSON (tick “include book files”), copy it together with this HTML file, then use <b>Restore</b> on the new device. Or just copy the HTML and re-import the books. The offline voice library is Windows-only: copy the <code>VoicePack</code> folder as well.</p>' +
      '<h3>What is “Resume” on the shelf?</h3><p>Listening position is remembered separately from reading position, so the two never interfere. After listening, the book card shows “▶ Resume · ch. N”; tap it to continue from the exact paragraph. To read from your reading position instead, open the book and tap <b>Read aloud</b>. The button only appears for books you have listened to.</p>' +
      '<h3>Can I change voice halfway through?</h3><p>Use the dropdown at the left of the reading bar — 11 curated voices by default, up to all 174 in Settings. To give dialogue its own voices, tap <b>Multi-voice</b>. The current paragraph is re-read with the new voice; no need to stop or go back to the shelf. <b>Preview voice</b> in Settings lets you compare first.</p>' +
      '<h3>How do highlights and notes work?</h3><p>Select text in the page, then choose a colour, add a note, copy, or make a share card. All highlights are listed under <b>Notes</b> in the side panel and stored with the book — they travel with a full backup. Export them as Markdown from that panel; the <b>Reading summary</b> collects them chapter by chapter.</p>' +
      '<h3>Buttons cramped on a phone?</h3><p>They reflow into a multi-row grid by screen width; nothing to switch by hand. Body text is always one column on a phone, even in landscape.</p>' +
      '<h3>How do I get two columns?</h3><p>Tap <b>Type</b> in the reader and look at <b>Reading mode</b>: switch to <b>Pages</b>, and Columns set to <b>Auto</b> gives you two columns on a wide window; <b>Two</b> forces it when the window is wide enough. Narrow windows and phones fall back to a single column rather than squeezing the text.<br>Paged mode turns whole screens, not pixels: tap the left or right edge, use the wheel, space or ← →, or swipe on a phone.</p>' +
      '<h3>How does auto reading work?</h3><p>Tap <b>Auto</b>: it scrolls at a steady pace, or turns a page every N seconds in paged mode. Tap again to pause — a small pill lets you resume or quit. The next chapter starts by itself at the end. Speech and auto reading never fight over the scroll position.</p>' +
      '<h3>Can I get more immersion?</h3><p>Tap <b>Full</b>: both bars slide away and come back when the pointer reaches the top or bottom edge. For a darker page, lower <b>Brightness</b> under Type → Colours.</p>' +
      '<p class="kv">Still stuck? Read the implementation notes under <b>About</b>, or find the feedback link in the bundled README.</p>',

    open: '<h3>License</h3>' +
      '<p><b>MoYin Reader (墨吟)</b> is released under the <b>MIT License</b>, copyright © 2026 Lanlan Eternal (永远的兰兰).</p>' +
      '<p>You may use, copy, modify, merge, publish, sublicense and even sell copies; the only obligation is to keep the copyright notice and this license. The software is provided “as is”, without warranty of any kind.</p>' +
      '<p class="kv">The full English text ships as the <code>LICENSE</code> file (standard MIT) and is also kept at the repository root — please keep it when redistributing.</p>' +
      '<h3>Third-party components</h3><ul>' +
      '<li><code>sherpa-onnx</code> speech engine — Apache-2.0, by the k2-fsa community; called as a local process only.</li>' +
      '<li><code>AISHELL3</code> Chinese multi-speaker VITS model — trained on the open AISHELL-3 corpus, used under its publisher’s Apache-2.0 terms.</li>' +
      '<li><code>pywebview</code> + <code>pythonnet</code> — BSD-3-Clause / MIT; used only by the Windows desktop shell to host the built-in page.</li>' +
      '<li><code>PyInstaller</code> — GPL-2.0 with the bootloader exception; used only to build the single-file exe and does not affect this project’s MIT licensing.</li>' +
      '<li>Microsoft Edge WebView2 runtime — distributed by Microsoft with the OS; not bundled or modified here, only the installed version is used.</li></ul>' +
      '<p>Copyright in those components belongs to their respective authors. This project does not modify their sources and makes no warranty about their behaviour, security or maintenance. The voice model files live in <code>VoicePack</code> (or inside the full exe) and can be deleted without affecting reading.</p>' +
      '<h3>What is original here</h3>' +
      '<p>The page, styles, <code>zipcore.js</code> (a from-scratch ZIP / DEFLATE / character-encoding kernel), EPUB parsing, speech scheduling, single-file bundler and self-test scripts are original work, also MIT-licensed. The DEFLATE decoder follows RFC 1951 and contains no zlib source.</p>' +
      '<h3>If you redistribute</h3>' +
      '<p>No book content is included. When passing the software on with the voice model, keep <code>LICENSE</code> and this document; do not remove the author credit in the interface, and do not imply that the original author endorses your build.</p>',

    disclaimer: '<p>This tool is for reading e-books you lawfully own. It provides, fetches and cracks no copyrighted content and circumvents no digital rights management (DRM). You are responsible for ensuring you have the right to use any file you import, and for any copyright dispute arising from that use.</p>' +
      '<p>Imported books, bookmarks, highlights, notes and progress are stored in this device’s browser database and are never uploaded; neither the author nor this page can access your files. <b>One exception</b>: if you deliberately choose an online voice whose name contains <code>Online (Natural)</code>, the browser sends the text being spoken to that speech service for synthesis. That is the browser speech engine’s behaviour and unrelated to how this tool stores books. Keep your original files and backups safe; the author is not liable for data loss caused by clearing browser data, device failure or file corruption.</p>' +
      '<p>The <code>sherpa-onnx</code> engine and the AISHELL3 Chinese multi-speaker model used by <b>Free neural voices</b> are third-party open-source software, downloaded and run at your own discretion under their own licenses. This tool only calls them locally; it does not distribute, modify or warrant them. Their services listen on 127.0.0.1 only and expose nothing to the network; use them on a network you trust.</p>' +
      '<p>Speech depends on engines provided by the operating system or browser. Voices, availability and phrasing vary by device and are not guaranteed to match a human reading. Do not listen while driving or operating machinery.</p>' +
      '<p>The software is provided “as is”, without any express or implied warranty. To the maximum extent permitted by law, the author is not liable for any direct or indirect loss (including data loss, device damage, or loss of time or income) arising from use of or inability to use this software.</p>' +
      '<p>The name “MoYin / 墨吟”, its interface and documentation are copyright the author. Other product, company and speech-service names mentioned here may be trademarks of their owners and are used for identification only, implying no affiliation, sponsorship or endorsement.</p>' +
      '<p>If you are a rights holder and believe this tool or its bundled content infringes your rights, contact the author through the address in the bundled README; verified issues will be handled promptly.</p>',

    about: '<p style="font-size:1.2em"><b>MoYin Reader · 墨吟</b></p>' +
      '<p>A single-file, offline-first TXT / EPUB reader with text-to-speech. Double-click the HTML and read; works in any modern browser on Windows, Linux, Android and iOS.</p>' +
      '<p>The Chinese name “墨吟” (“ink, and reading aloud”) and the English name are used by this project only. They are <b>not affiliated with</b> any company, voice platform or streamer of a similar name, and imply no commercial endorsement.</p>' +
      '<p>The shelf + reader layout and the speech scheduling were informed by Koodo Reader on this machine, with all code rewritten from zero and no dependencies: EPUB unzipping, OPF / NCX / Nav contents, body and illustration parsing are all built in, with no external scripts or CDN.</p>' +
      '<p class="kv">Speech can use the free open-source offline neural voices (sherpa-onnx + AISHELL3 multi-speaker VITS): no network, no fees, no account. The model contains 174 Chinese speakers (148 female + 26 male), 11 curated by default, and supports role-based reading. The library ships in <code>VoicePack</code>; the full Windows EXE has it appended inside, so one file is enough.</p>' +
      '<p>Released under the <b>MIT License</b>: use, modify and redistribute freely, including commercially, keeping the copyright and license notice. Full terms under <b>Open source &amp; license</b>.</p>' +
      '<h3>What is new in 1.9</h3><ul>' +
      '<li><b>Columns stay simple</b>: one or two, nothing more — three or four columns just make Chinese text hard to read. The picker offers <b>Auto / 1 / 2</b>; Auto decides from screen width, and phones always stay single. Picking two columns switches to Pages.</li>' +
      '<li><b>Theme button opens a picker</b>: it used to cycle one step per tap. Now it shows all six themes as cards painted in their own paper and ink, so you can compare them side by side; the panel stays open and each pick applies at once.</li>' +
      '<li><b>Settings always reachable</b>: a <b>Settings</b> button now sits at the end of the reading toolbar, so the full settings are one tap away at any time. On phones the buttons wrap into two tidy rows.</li>' +
      '<li><b>Reading clock</b>: the toolbar shows the current time and how long you have read this session; it turns amber at 30 minutes and red at 60. In immersive mode a faint clock stays in the top-right corner. Tap it to hide it or restart the timer.</li>' +
      '<li><b>Break reminder</b>: after the set stretch (45 minutes by default; 30 / 45 / 60 / 90 or off) a reminder floats up. Take a break to restart the timer, or snooze for ten minutes. Only actual reading counts — going back to the shelf or leaving the window pauses it.</li>' +
      '<li><b>No more half columns</b>: the page step is now measured from the real column pitch, so an extra partial column gets corrected immediately.</li></ul>' +
      '<h3>What is new in 1.8 — typography that can hold its own</h3><ul>' +
      '<li><b>Paged reading</b>: alongside scrolling, the whole chapter can now turn page by page. Wide screens and tablets get <b>two columns</b>, phones stay <b>single column</b>. Tap the left or right edge, use the wheel, space, ← →, or swipe on a phone; the turn animation can slide, fade or none.</li>' +
      '<li><b>One type panel</b>: the <b>Type</b> button collects everything — font size (A− / A+ / slider), line height, paragraph gap, letter spacing, first-line indent, five families (Song / Hei / Kai / FangSong / Mono), justified or ragged right, measure width and side margins, with a reset at the bottom.</li>' +
      '<li><b>Six themes</b>: dark, light and sepia, plus <b>green, slate and pure black</b>; you can also pick your own paper and text colour and clear them again. Dark mode has an extra brightness dimmer for reading with the lights off.</li>' +
      '<li><b>Auto read</b>: continuous scrolling, or timed page turns in paged mode. Pause and resume from a small pill; the next chapter starts automatically at the end.</li>' +
      '<li><b>Immersive full screen</b>: both bars slide away and come back when the pointer reaches the top or bottom edge. F11 or the <b>Full</b> button; Esc backs out step by step.</li>' +
      '<li><b>Two long-standing bugs fixed</b>: styles shipped inside a book (things like <code>body{margin:5%}</code>) used to leak onto the reading container and squeeze the measure — which is why the right column of a two-column page was clipped. Books can now only style their own paragraphs; the measure and type scale are yours. A chapter heading repeated inside the body is also removed.</li></ul>' +
      '<h3>What was fixed in 1.8.1</h3><ul>' +
      '<li><b>“Two columns” now works the moment you pick it.</b> Previously you had to switch to Pages first; choosing it while scrolling did nothing, which looked broken. Picking two columns now switches to Pages and lays out both columns right away, and going back to Scroll returns to one column — both directions show a short notice. Same for TXT and EPUB.</li>' +
      '<li><b>Switching reading mode keeps your place</b>: flip between scroll and pages mid-chapter and you stay on the paragraph you were reading instead of jumping back to the start.</li>' +
      '<li><b>More room at the foot of the page</b>: the last line no longer sits against the bottom toolbar in paged mode.</li></ul>' +
      '<h3>What is new in 1.7</h3><ul>' +
      '<li><b>Full bilingual interface</b>: one switch on the shelf flips the entire window — buttons, settings, dialogs, toasts and all documentation — between Chinese and English. Your choice is remembered.</li>' +
      '<li><b>Highlights &amp; notes</b>: select text to highlight it in four colours, attach a note, or both. Every annotation is listed in the new <b>Notes</b> panel where you can jump to it, edit it or delete it.</li>' +
      '<li><b>Share cards</b>: turn a highlight into a PNG card with the book title and excerpt, ready to post.</li>' +
      '<li><b>Export &amp; summary</b>: export all notes as Markdown or plain text; <b>Reading summary</b> reports time read, streak, progress and a chapter-by-chapter excerpt list you can export.</li>' +
      '<li><b>Real shelves</b>: create, rename and delete shelves, mark favorites, batch move or remove books, edit title and author, and import a whole folder of books at once.</li>' +
      '<li><b>Reading time</b>: every session is timed and accumulated per book and overall, without sending anything anywhere.</li></ul>' +
      '<p class="kv">Fixed in 1.7.1</p><ul>' +
      '<li><b>Highlighting now works in the desktop app</b> — the Windows shell disabled web text selection by default, so dragging over the text did nothing and the colour toolbar never appeared. Selection is enabled now.</li>' +
      '<li><b>Folder import no longer looks like an upload</b> — the desktop build opens the native folder picker instead of the browser\'s “select the folder to upload … Upload” dialog.</li>' +
      '<li><b>The left sidebar can be dismissed</b> — there is a × on the tab strip, clicking the same toolbar button toggles it, and clicking the page closes it (unless you have text selected, so a fresh selection is never disturbed).</li></ul>' +
      '<p class="kv">Version 1.9.0 · single file · offline by default · data stays on this device<br>Author / copyright © 2026 Lanlan Eternal (永远的兰兰)<br>Feedback and source: see the repository address in the bundled README</p>'
  };
})(window);
