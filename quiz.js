(function(global) {

    // Quiz object
    const Quiz = function(config) {
        this.indexSheetUrl = config.indexSheetUrl;
        this.containerId = config.containerId;
        this.questions = [];
        this.currentIndex = 0;
        this.totalScore = 0;
        this.waitingForNext = false;
        this.quizList = [];
    };

    Quiz.prototype.init = function() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            console.error(`Container #${this.containerId} not found`);
            return;
        }

        this.container.innerHTML = `
            <div id="options" class="options">
                <h1>Select a test</h1>
                <div id="file-buttons" class="buttons"></div>
            </div>
            <div class="questionaire">
                <h1 id="test-name">Test</h1>
                <div id="question"></div>
                <div id="question-options" class="buttons"></div>
                <div id="score"></div>
                <div id="explain-link"></div>
            </div>
        `;

        this.loadQuizList();
    };

    Quiz.prototype.loadQuizList = async function() {
        const exportUrl = `https://docs.google.com/spreadsheets/d/${this.indexSheetUrl}/export?format=csv`;
        const response = await fetch(exportUrl);
        const csv = await response.text();
        this.quizList = csv.trim().split("\n").slice(1).map(row => {
            const cols = row.split(",");
            return {
                name: cols[0],
                url: `https://docs.google.com/spreadsheets/d/${cols[1]}/export?format=csv&gid=${cols[2]}`
            };
        });
        this.populateQuizButtons();
    };

    Quiz.prototype.populateQuizButtons = function() {
        const container = this.container.querySelector("#file-buttons");
        container.innerHTML = "";
        this.quizList.forEach(q => {
            const btn = document.createElement("div");
            btn.className = "answer-btn default";
            btn.textContent = q.name;
            btn.onclick = () => this.loadGoogleSheet(q.url, q.name);
            container.appendChild(btn);
        });
    };

    Quiz.prototype.loadGoogleSheet = function(url, name) {
        fetch(url).then(r => r.text()).then(text => {
            this.questions = this.parseCSV(text);
            this.currentIndex = 0;
            this.totalScore = 0;
            this.waitingForNext = false;
            this.renderQuestion();
        });
        this.container.querySelector("#options").className = "options minimised";
        this.container.querySelector("#test-name").innerText = name;
    };

    Quiz.prototype.parseCSV = function(text) {
        const lines = text.trim().split("\n");
        return lines.map(line => {
            const cols = line.split(",");
            const answers = [
                { text: cols[2], points: Number(cols[3]) },
                { text: cols[4], points: Number(cols[5]) },
                { text: cols[6], points: Number(cols[7]) },
                { text: cols[8], points: Number(cols[9]) }
            ];
            this.shuffleArray(answers);
            return {
                question: cols[0],
                text: cols[1],
                answers: answers,
                explanation: cols[10]
            };
        });
    };

    Quiz.prototype.shuffleArray = function(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    };

    function getOverallLevel(percentage) {
    if (percentage <= 20) return "Basic level";
    if (percentage <= 40) return "Working level";
    if (percentage <= 60) return "Extensive level";
    if (percentage <= 80) return "Expert level";
    return "Mastery level";
}

// Render the current question
function renderQuestion() {
    const quizContainer = document.getElementById("question-options");
    const questionContainer = document.getElementById("question");
    const videoContainer = document.getElementById("explain-link");
    const scoreContainer = document.getElementById("score");

    quizContainer.innerHTML = "";
    questionContainer.innerHTML = "";
    videoContainer.innerHTML = "";
    scoreContainer.innerHTML = "";

    if (currentIndex >= questions.length) {
        questionContainer.innerHTML = `<h2>Quiz Complete!</h2>`;
        const maxScore = questions.length * 100;
        const percentage = (totalScore / maxScore) * 100;
        const level = getOverallLevel(percentage);

        scoreContainer.innerHTML = `
            <h3>Total Score: ${percentage.toFixed(1)}%</h3>
            <h3>Performance Level: ${level}</h3>
        `;
        return;
    }

    const q = questions[currentIndex];

    questionContainer.innerHTML = `<h2>${q.question}</h2>`;
    questionContainer.insertAdjacentHTML("beforeend", parseText(q.text));

    q.answers.forEach(ans => {
        const btn = document.createElement("div");
        btn.className = "answer-btn";
        btn.textContent = ans.text;
        btn.onclick = () => handleAnswer(ans.points, q.explanation, btn);
        quizContainer.appendChild(btn);
    });
}

// Handle answer logic
function handleAnswer(points, explanationRaw, selectedBtn) {
    if (waitingForNext) return;

    const videoContainer = document.getElementById("explain-link");
    totalScore += points;

    highlightSelectedAnswer(selectedBtn, points);

    videoContainer.innerHTML = "";

    if (points === 0) {
        // WRONG → show explanation immediately
        videoContainer.innerHTML =
            `<h3>Incorrect</h3>` +
            parseText(explanationRaw);
    }    
	else if (points <= 50) {
        // WRONG → show explanation immediately
        videoContainer.innerHTML =
            `<h3>Partially correct</h3>` +
            parseText(explanationRaw);
    }     
	else if (points <= 75) {
        // WRONG → show explanation immediately
        videoContainer.innerHTML =
            `<h3>Almost!</h3>` +
            parseText(explanationRaw);
    } 
	else {
        // RIGHT → show button to reveal explanation
        videoContainer.innerHTML = `<h3>Correct!</h3>`;

        const explanationBtn = document.createElement("div");
        explanationBtn.className = "answer-btn default";
        explanationBtn.style.width = "fit-content";
        explanationBtn.textContent = "See Explanation";

        const expContainer = document.createElement("div");

        explanationBtn.onclick = () => {
            expContainer.innerHTML = parseText(explanationRaw);
            explanationBtn.style.display = "none";
        };

        videoContainer.appendChild(explanationBtn);
        videoContainer.appendChild(expContainer);
    }

    showNextButton();
    waitingForNext = true;
}

// Convert normal YouTube link to embed URL
function convertToEmbed(url) {
    return url
        .replace("watch?v=", "embed/")
        .replace("youtu.be/", "youtube.com/embed/");
}

function goToNextQuestion() {
    waitingForNext = false;
    currentIndex++;
    renderQuestion();
}

function showNextButton() {
  const videoContainer = document.getElementById("explain-link");

  // Remove old button if it exists
  const oldBtn = document.getElementById("next-question-btn");
  if (oldBtn) oldBtn.remove();

  const nextBtn = document.createElement("div");
  nextBtn.className = "answer-btn next";
  nextBtn.id = "next-question-btn";
  nextBtn.textContent = "Next Question";

  // Style
  nextBtn.style.display = "block";
  nextBtn.style.marginTop = "20px";

  // Assign click handler (preferred)
  nextBtn.addEventListener('click', goToNextQuestion);

  videoContainer.appendChild(nextBtn);
}


function highlightSelectedAnswer(selectedBtn, points) {
    if (points === 0) {
        selectedBtn.classList.add("wrong");
    } else {
        selectedBtn.classList.add("correct");
    }
}

function parseText(text) {
    if (!text) return "";

    return text.replace(/\{([^}]+)\}/g, (match, content) => {
        const url = content.trim();
        const lower = url.toLowerCase();

        // Image detection
        if (lower.match(/\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/)) {
            const filename = url.split("/").pop().split("?")[0]; // remove query params
            const alt = filename.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]/g, " ").trim();
            const altText = alt.charAt(0).toUpperCase() + alt.slice(1);
            return `<img src="${url}" alt="${altText}" class="q-img">`;
        }

        // YouTube detection
        if (lower.includes("youtu")) {
            const embed = convertToEmbed(url);
            return `
                <div class="embedded-media">
                    <iframe src="${embed}" allowfullscreen></iframe>
                    <br><a href="${url}" target="_blank">Open link</a>
                </div>
            `;
        }

        // Other URL
        if (lower.startsWith("http") || lower.startsWith("www.")) {
            return `<a href="${url}" target="_blank">${url}</a>`;
        }

        // Fallback
        return url;
    });
}

const questionaire = document.getElementById("questionaire");
questionaire.innerHTML = "";

const options = document.createElement("div");
options.id = "options";
options.className = "options";
options.innerHTML = `
    <h1>Select a test</h1>
    <div id="file-buttons" class="buttons"></div>
`;

const main = document.createElement("div");
main.className = "questionaire";
main.innerHTML = `
    <h1 id="test-name">Test</h1>
    <div id="question"></div>
    <div id="question-options" class="buttons"></div>
    <div id="score"></div>
    <div id="explain-link"></div>
`;

questionaire.appendChild(options);
questionaire.appendChild(main);

window.onload = loadQuizList;

    Quiz.prototype.start = function() {
        this.init();
    };

    // Expose globally
    global.Quiz = Quiz;

})(window);
