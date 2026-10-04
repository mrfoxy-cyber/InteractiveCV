const assetRoot = "assets/cv/interactive";

const list = (items) => `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;

const groupedCourses = (groups) => `<div class="course-groups">${Object.entries(groups).map(([category, courses]) => `<details class="course-group"><summary>${category}</summary>${list(courses)}</details>`).join("")}</div>`;

const tartuCourses = {
  "Mathematics & algebra": [
    "Elementary Mathematics I", "Set Theory and Mathematical Logic", "Algebra and Geometry",
    "Data Analysis I", "Elements of Discrete Mathematics", "Graphs", "Calculus I"
  ],
  "IT & programming": [
    "Computer Handling", "Computer Programming", "Application Software: SQL", "Object-Oriented Programming",
    "Application Software: Access", "Computer Hardware I", "Application Software: PHP for Beginners",
    "Software Engineering", "Artificial Intelligence I", "Logic Programming Techniques", "Software Project",
    "Web Information Systems", "Automata, Languages and Compilers", "IT Standards", "Operating Systems", "Software Testing"
  ],
  "Design & art": [
    "Drawing I: Portrait and Figure Drawing, Part 1", "Drawing I: Portrait and Figure Drawing, Part 2",
    "Painting I: Still Life Painting", "Painting II: Figure Painting", "Composition I: Elementary Course",
    "User Interface Design", "Basics of Digital Painting", "Multimedia"
  ],
  "Other studies": ["Physical Concept of the World", "Electrical Measurements", "Project Management"]
};

const details = {
  collection: {
    projects: {
      kicker: "Projects",
      title: "My potato projects",
      art: `${assetRoot}/projects/sack-empty.png`,
      body: () => `<ul class="project-list">${Object.values(details.project).map((project) => `<li><details class="project-list__item"><summary><img src="${project.art}" alt=""><span>${project.title}</span></summary><div class="project-list__body"><p class="dialog-kicker">${project.kicker}</p>${project.body}</div></details></li>`).join("")}</ul>`
    }
  },
  profile: {
    marju: {
      kicker: "Profile",
      title: "Junior Software Developer",
      art: `${assetRoot}/character/marju-natural-v2.png`,
      body: `<p>I am a software developer with professional experience in QA, application support, and C/AL development for Microsoft Dynamics NAV-based finance systems.</p><p>In my personal projects I work with C++20, C#/.NET, Go, Python, SQL, and PostgreSQL. I am currently developing Mental Model Graph, a C++20 tool for understanding and verifying complex software systems, and Goatly, a C#/.NET learning platform using Clean Architecture, Entity Framework Core, PostgreSQL, and automated testing.</p><p>I also create children's stories for my son.</p><p class="detail-meta">Driving licence B · References gladly provided on request</p><div class="detail-links"><a href="https://www.linkedin.com/in/marju-h-6b4b02116" target="_blank" rel="noreferrer">LinkedIn</a><a href="https://github.com/mrfoxy-cyber" target="_blank" rel="noreferrer">GitHub</a></div>`
    }
  },
  project: {
    goatly: {
      kicker: "Ongoing personal project",
      title: "Goatly",
      art: `${assetRoot}/projects/goatly.png`,
      body: `<p class="detail-meta">A concept-based language-learning platform for children with language delays and multilingual backgrounds.</p><p>Goatly connects educators, caregivers, and languages spoken at home. It makes visual communication support more engaging through personalised characters, voices, playful activities, and learning journeys that connect the app with real-world experiences.</p><p>The project began with Encore, Go, TypeScript, and HTML. It is now being rebuilt in C# and .NET using Clean Architecture. The work includes child-safe asset access, role-based permissions, concurrency, reliable tests, and maintainable system boundaries.</p><details><summary>Technologies</summary><p>C# · .NET 10 · ASP.NET Core Web API · Entity Framework Core · PostgreSQL · SQL · Go · Encore · Python · HTML/CSS/JavaScript · REST APIs · Clean Architecture · authentication · object storage · caching · AI image and speech integration · xUnit · GitHub Actions · Docker · WSL</p></details><div class="detail-links"><a href="https://github.com/mrfoxy-cyber/goatly_example" target="_blank" rel="noreferrer">Goatly example</a><a href="https://staging-boatly-rbz2.encr.app/login" target="_blank" rel="noreferrer">Live demo</a></div><h3>Live demo access</h3><p>Sign in with any of the test accounts below. All accounts use the same demo password.</p><p>Demo password: <code>Boatly-Staging-2026!</code></p><ul><li>Member view: <code>member@gmail.com</code></li><li>Parent view: <code>parent@gmail.com</code></li><li>Second parent: <code>parent2@gmail.com</code></li><li>Educator view: <code>educator@gmail.com</code></li><li>Second educator: <code>educator2@gmail.com</code></li></ul>`
    },
    mmg: {
      kicker: "Ongoing personal project",
      title: "Mental Model Graph",
      art: `${assetRoot}/projects/mmg.png`,
      body: `<p>A source-code analysis tool that transforms C++ codebases into navigable graphs, helping developers understand how components, relationships, tests, and evidence fit together.</p><p>MMG uses C++20, CMake, Python, and Tree-sitter for AST-based extraction and currently runs as a locally built command-line application. Its custom test framework keeps required behaviours visible and supports both expert judgement and systematic techniques such as decision tables and equivalence partitioning.</p><p class="detail-meta">C++20 · CMake · Tree-sitter · Python · graph traversal · test-framework design</p><div class="detail-links"><a href="https://github.com/mrfoxy-cyber/mmg_example" target="_blank" rel="noreferrer">MMG example</a></div>`
    },
    frog: {
      kicker: "Personal project · 2024",
      title: "Frog Game",
      art: `${assetRoot}/projects/frog-game.png`,
      body: `<p>A silly, soothing puzzle game for children and adults. It strengthens logical thinking while offering a calm escape during stressful moments.</p><p>The original game was built from scratch in Unity and C# and released as an Android APK. I later reused the original visual and audio assets that remained to create a similar browser game with JavaScript, HTML, and CSS. The web edition is a lightweight recreation of the core puzzle logic rather than a direct Unity export.</p><p class="detail-meta">C# · Unity · JavaScript · HTML/CSS · OOP · Blender · Adobe Photoshop · Android · web deployment</p><div class="detail-links"><a href="frog-game/">Play Frog Game</a><a href="https://github.com/mrfoxy-cyber/FrogGame" target="_blank" rel="noreferrer">GitHub repository</a></div>`
    }
  },
  language: {
    estonian: { kicker: "Language", title: "Estonian", art: `${assetRoot}/languages/estonian-tail-right.png`, audio: `${assetRoot}/languages/sound/Estonian.mp3`, body: `<p class="detail-meta">Native proficiency</p><p>Listen to Marju speak Estonian.</p>` },
    english: { kicker: "Language", title: "English", art: `${assetRoot}/languages/english-tail-right.png`, audio: `${assetRoot}/languages/sound/English.mp3`, body: `<p class="detail-meta">Professional proficiency</p><p>Listen to Marju speak English.</p>` },
    swedish: { kicker: "Language", title: "Swedish", art: `${assetRoot}/languages/swedish-tail-right.png`, audio: `${assetRoot}/languages/sound/Swedish.mp3`, body: `<p class="detail-meta">Professional proficiency</p><p>Listen to Marju speak Swedish.</p>` },
    german: { kicker: "Language", title: "German", art: `${assetRoot}/languages/german-tail-right.png`, audio: `${assetRoot}/languages/sound/German.mp3`, body: `<p class="detail-meta">Elementary proficiency</p><p>Listen to Marju speak German.</p>` }
  },
  skill: {
    testing: { kicker: "Skill", title: "Software testing", art: `${assetRoot}/skills/testing.png`, body: `<p>Manual, functional, regression, unit, and integration testing. Experience includes xUnit, NUnit, Given/When/Then, debugging, test planning, acceptance criteria, defect investigation, testable specifications, and traceability from requirements to tests.</p>` },
    support: { kicker: "Skill", title: "Application support", art: `${assetRoot}/skills/support.png`, body: `<p>Customer communication, ticket triage, technical documentation, export-file investigation, and troubleshooting in Microsoft Dynamics NAV-based finance systems.</p><p class="detail-meta">Zendesk · C/AL · Microsoft Dynamics NAV · finance workflows</p>` },
    cpp: { kicker: "Development", title: "C++20", art: `${assetRoot}/skills/cpp.png`, body: `<p>Modern C++ development through Mental Model Graph: graph structures, breadth-first traversal, AST extraction, CMake, custom test-framework design, static code analysis, and maintainable software architecture.</p>` },
    csharp: { kicker: "Development", title: "C# & .NET", art: `${assetRoot}/skills/csharp.png`, body: `<p>C# and .NET development across Goatly and Frog Game, including ASP.NET Core Web APIs, Entity Framework Core, Clean Architecture, Domain-Driven Design, Unity, OOP, REST APIs, PostgreSQL, database migrations, authentication, and automated testing.</p>` },
    python: { kicker: "Development", title: "Python", art: `${assetRoot}/skills/python.png`, body: `<p>Python for source-code extraction and generation tooling in MMG, plus supporting development utilities within Goatly's technology landscape.</p>` },
    playwright: { kicker: "Test automation", title: "Playwright", art: `${assetRoot}/skills/playwright.png`, body: `<p>Created Playwright tests to protect future development and manually tested a sportsbook, finding defects that were corrected before release.</p>` },
    gitlab: { kicker: "Delivery", title: "Git, GitHub & CI/CD", art: `${assetRoot}/skills/gitlab.png`, body: `<p>Git and GitHub workflows, code review, GitHub Actions, CI/CD basics, Visual Studio, Docker, WSL, Agile/Scrum, and experience across the full software development lifecycle.</p>` }
  },
  education: {
    skovde: { kicker: "Education", title: "University of Skövde", art: `${assetRoot}/education/skovde-open.png`, body: `<p class="detail-meta">Bachelor's degree in Informatics · 180 university credits</p><p>The degree combined transferred studies from Estonia with additional coursework in Sweden. The thesis investigated email classification using Latent Dirichlet Allocation and a Random Forest classifier, including how additional information affected accuracy.</p><h3>Courses</h3>${groupedCourses({ "Mathematics & algebra": ["Quantitative Methods for Computer Scientists"], "IT & programming": ["Software Testing", "Algorithms and Data Structures", "Systems Development: Research and Development", "Degree Project in Information Technology"], "Languages": ["English: General Language Proficiency", "English: Academic Writing"], "Other studies": ["Systems Thinking", "Industrial Systems Philosophies"] })}<div class="detail-links"><a href="https://his.diva-portal.org/smash/get/diva2:1182329/FULLTEXT01.pdf" target="_blank" rel="noreferrer">Read the thesis</a></div>` },
    tartu: { kicker: "Education", title: "University of Tartu", art: `${assetRoot}/education/tartu-open.png`, body: `<p class="detail-meta">Informatics · 2007–2010</p><h3>Completed courses</h3>${groupedCourses(tartuCourses)}` },
    gymnasium: { kicker: "Education", title: "Estonian Gymnasium", art: `${assetRoot}/education/gymnasium-open.png`, body: `<p class="detail-meta">Upper secondary education · Graduated 2007</p><p>Subjects contributing to STEM eligibility:</p>${groupedCourses({ "Mathematics & algebra": ["Mathematics"], "Other studies": ["Physics", "Chemistry", "Biology", "Natural Science"] })}` },
    komvux: { kicker: "Education", title: "Komvux", art: `${assetRoot}/education/komvux-open.png`, body: `<p class="detail-meta">2013–2015</p>${groupedCourses({ "Languages": ["English 6", "English 7", "Swedish as a Second Language 1–3"] })}` },
    lexicon: { kicker: "Ongoing education", title: "Full-stack Developer", art: `${assetRoot}/education/lexicon-open.png`, body: `<p class="detail-meta">Lexicon & Luleå University of Technology · 45-week full-time remote programme</p><p>The programme combines 19 weeks of hands-on programming with a 30-credit academic phase at LTU and a one-month workplace placement in northern Sweden.</p>${groupedCourses({ "IT & programming": ["Applied programming and workplace-style projects", ".NET and object-oriented programming with C#", "Relational database design and SQL", "Unit and integration testing", "Web development and REST APIs", "Agile development and the full software development lifecycle"] })}` },
    courses: { kicker: "Additional university studies", title: "Standalone courses", art: `${assetRoot}/education/standalone-courses.png`, body: `${groupedCourses({ "Design & art": ["Digital Painting and Idea Visualisation<span class=\"course-meta\">Luleå University of Technology · 2016</span>", "Game Design<span class=\"course-meta\">Luleå University of Technology · 2016</span>", "3D Modelling and Visualisation with ZBrush<span class=\"course-meta\">Uppsala University · 2016</span>", "3D Modelling and Animation in an Open Source Environment<span class=\"course-meta\">University of Gävle · 2016</span>"] })}` }
  },
  work: {
    experience: {
      kicker: "Professional experience",
      title: "Work experience",
      art: `${assetRoot}/work/suitcase-open.png`,
      body: `<h3>QA Engineer · Silverspin</h3><p class="detail-meta">2024–2025 · Skövde</p><p>Created Playwright tests as safeguards for future development and manually tested the sportsbook, identifying defects that were fixed before release.</p><p class="detail-meta">GitHub · Playwright · Visual Studio · Docker · testing</p><h3>Application Support Consultant · Aptic</h3><p class="detail-meta">2020–2024 · Skövde</p><p>Handled incoming support calls, routed requests to the right specialists, wrote documentation, and investigated errors in Microsoft Dynamics NAV export files.</p><p class="detail-meta">Zendesk · C/AL · Microsoft Dynamics NAV</p><h3>System Developer · Asitis</h3><p class="detail-meta">2017–2020 · Skövde</p><p>Performed broad manual testing and stopped releases when defects needed correction. Wrote requirements, traced defects through C/AL code, and presented precise findings to developers. Redesigned an Excel-based collaborative test method and proposed a more risk-based process.</p><p class="detail-meta">C/AL · Microsoft Dynamics NAV · Visual Studio · requirements · risk-based testing</p><h3>Garden Nursery Assistant · Aspelund Tak &amp; Trädgård</h3><p class="detail-meta">2013 · Skaraborg</p><p>Cared for plants and sold nursery products at markets, combining practical responsibility with direct customer service.</p><h3>Playhost · Tallink</h3><p class="detail-meta">2010–2012 · Tallinn–Stockholm–Helsinki</p><p>Planned and hosted children's activities, ran evening karaoke for adults, and reorganised song data in the karaoke system to make the catalogue easier to search.</p>`
    }
  }
};

document.addEventListener("keydown", (event) => {
  if (["Tab", "Enter", " ", "Escape"].includes(event.key) || event.key.startsWith("Arrow")) {
    document.documentElement.classList.add("keyboard-navigation");
  }
}, true);
document.addEventListener("pointerdown", () => {
  document.documentElement.classList.remove("keyboard-navigation");
}, true);

const dialog = document.querySelector("#detail-dialog");
const detailArt = document.querySelector("#detail-art");
const detailKicker = document.querySelector("#detail-kicker");
const detailTitle = document.querySelector("#detail-title");
const detailBody = document.querySelector("#detail-body");
const closeButton = dialog.querySelector(".dialog-close");
let lastTrigger = null;
let activeAudio = null;

function stopActiveAudio() {
  if (!activeAudio) return;
  activeAudio.pause();
  activeAudio.currentTime = 0;
  activeAudio = null;
}

document.querySelectorAll("[data-kind][data-key]").forEach((button) => {
  button.addEventListener("click", () => {
    const item = details[button.dataset.kind]?.[button.dataset.key];
    if (!item) return;
    stopActiveAudio();
    lastTrigger = button;
    detailKicker.textContent = item.kicker;
    detailTitle.textContent = item.title;
    detailBody.innerHTML = typeof item.body === "function" ? item.body() : item.body;
    detailArt.replaceChildren();
    const image = new Image();
    image.src = item.art;
    image.alt = "";
    detailArt.append(image);
    if (item.audio) {
      const recording = new Audio(item.audio);
      activeAudio = recording;
      recording.id = "language-recording";
      recording.className = "language-audio";
      recording.controls = true;
      recording.autoplay = false;
      recording.preload = "none";
      recording.playsInline = true;
      recording.setAttribute("aria-label", `${item.title} recording spoken by Marju`);

      const playButton = document.createElement("button");
      playButton.type = "button";
      playButton.className = "language-play";
      playButton.textContent = `Play ${item.title} recording`;
      playButton.setAttribute("aria-controls", recording.id);
      const audioStatus = document.createElement("p");
      audioStatus.className = "sr-only";
      audioStatus.setAttribute("role", "status");
      audioStatus.setAttribute("aria-atomic", "true");

      recording.addEventListener("play", () => {
        playButton.textContent = `Pause ${item.title} recording`;
        audioStatus.textContent = `${item.title} recording playing.`;
      });
      recording.addEventListener("pause", () => {
        playButton.textContent = `Play ${item.title} recording`;
        if (!recording.ended) audioStatus.textContent = `${item.title} recording paused.`;
      });
      recording.addEventListener("ended", () => {
        playButton.textContent = `Play ${item.title} recording`;
        audioStatus.textContent = `${item.title} recording finished.`;
      });
      recording.addEventListener("error", () => {
        playButton.textContent = `Play ${item.title} recording`;
        audioStatus.textContent = "The recording could not be loaded. Please try again.";
      });
      playButton.addEventListener("click", async () => {
        if (!recording.paused) {
          recording.pause();
          return;
        }
        try {
          await recording.play();
        } catch (error) {
          if (dialog.open && activeAudio === recording) {
            audioStatus.textContent = "The recording could not be played. Please try again.";
          }
        }
      });
      detailBody.append(playButton, recording, audioStatus);
    }
    dialog.showModal();
    dialog.scrollTop = 0;
    detailTitle.focus();
  });
});

closeButton.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener("close", () => {
  stopActiveAudio();
  lastTrigger?.focus();
});
