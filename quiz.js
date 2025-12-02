(function(global) {

    class Quiz {
        constructor(config) {
            this.indexSheetUrl = config.indexSheetUrl;
            this.containerId = config.containerId;

            // State
            this.questions = [];
            this.currentIndex = 0;
            this.totalScore = 0;
            this.waitingForNext = false;
            this.quizList = [];
        }

        start() {
            this.init();
        }

        init() {
            this.container = document.getElementById(this.containerId);
            if (!this.container) {
                console.error(`Container #${this.containerId} not found`);
                return;
            }

            // Clear container and add basic structure
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
        }

        async loadQuizList() {
            try {
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
            } catch (err) {
                console.error("Failed to load quiz list:", err);
            }
        }

        populateQuizButtons() {
            const container = this.container.querySelector("#file-buttons");
            container.innerHTML = "";

            this.quizList.forEach(q => {
                const btn = document.createElement("div");
                btn.className = "answer-btn default";
                btn.textContent = q.name;
                btn.onclick = () => this.loadGoogleSheet(q.url, q.name);
                container.appendChild(btn);
            });
        }

        async loadGoogleSheet(url, name) {
            try {
                const response = await fetch(url);
                const text = await response.text();

                this.questions = this.parseCSV(text);
                this.currentIndex = 0;
                this.totalScore = 0;
                this.waitingForNext = false;

                this.renderQuestion();
            } catch (err) {
                console.error("Failed to load quiz:", err);
            }

            const optionsContainer = this.container.querySelector("#options");
            optionsContainer.className = "options minimised";

            const testName = this.container.querySelector("#test-name");
            testName.innerText = name;
        }

        parseCSV(text) {
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
                    answers,
                    explanation: cols[10]
                };
            });
        }

        shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        }

        getOverallLevel(percentage) {
            if (percentage <= 20) return "Basic level";
            if (percentage <= 40) return "Working level";
            if (percentage <= 60) return "Extensive level";
            if (percentage <= 80) return "Expert level";
            return "Mastery level";
        }

        renderQuestion() {
            const qContainer = this.container.querySelector("#question");
            const quizContainer = this.container.querySelector("#question-options");
            const videoContainer = this.container.querySelector("#explain-link");
            const scoreContainer = this.container.querySelector("#score");

            quizContainer.innerHTML = "";
            qContainer.innerHTML = "";
            videoContainer.innerHTML = "";
            scoreContainer.innerHTML = "";

            if (this.currentIndex >= this.questions.length) {
                qContainer.innerHTML = `<h2>Quiz Complete!</h2>`;
                const maxScore = this.questions.length * 100;
                const percentage = (this.totalScore / maxScore) * 100;
                const level = this.getOverallLevel(percentage);
                scoreContainer.innerHTML = `
                    <h3>Total Score: ${percentage.toFixed(1)}%</h3>
                    <h3>Performance Level: ${level}</h3>
                `;
                return;
            }

            const q = this.questions[this.currentIndex];
            qContainer.innerHTML = `<h2>${q.question}</h2>`;
            qContainer.insertAdjacentHTML("beforeend", this.parseText(q.text));

            q.answers.forEach(ans => {
                const btn = document.createElement("div");
                btn.className = "answer-btn";
                btn.textContent = ans.text;
                btn.onclick = () => this.handleAnswer(ans.points, q.explanation, btn);
                quizContainer.appendChild(btn);
            });
        }

        handleAnswer(points, explanationRaw, selectedBtn) {
            if (this.waitingForNext) return;

            const videoContainer = this.container.querySelector("#explain-link");
            this.totalScore += points;

            this.highlightSelectedAnswer(selectedBtn, points);
            videoContainer.innerHTML = "";

            if (points === 0) {
                videoContainer.innerHTML = `<h3>Incorrect</h3>` + this.parseText(explanationRaw);
            } else if (points <= 50) {
                videoContainer.innerHTML = `<h3>Partially correct</h3>` + this.parseText(explanationRaw);
            } else if (points <= 75) {
                videoContainer.innerHTML = `<h3>Almost!</h3>` + this.parseText(explanationRaw);
            } else {
                videoContainer.innerHTML = `<h3>Correct!</h3>`;
                const expBtn = document.createElement("div");
                expBtn.className = "answer-btn default";
                expBtn.style.width = "fit-content";
                expBtn.textContent = "See Explanation";
                const expContainer = document.createElement("div");

                expBtn.onclick = () => {
                    expContainer.innerHTML = this.parseText(explanationRaw);
                    expBtn.style.display = "none";
                };

                videoContainer.appendChild(expBtn);
                videoContainer.appendChild(expContainer);
            }

            this.showNextButton();
            this.waitingForNext = true;
        }

        highlightSelectedAnswer(selectedBtn, points) {
            if (points === 0) {
                selectedBtn.classList.add("wrong");
            } else {
                selectedBtn.classList.add("correct");
            }
        }

        showNextButton() {
            const videoContainer = this.container.querySelector("#explain-link");
            const oldBtn = videoContainer.querySelector("#next-question-btn");
            if (oldBtn) oldBtn.remove();

            const nextBtn = document.createElement("div");
            nextBtn.className = "answer-btn next";
            nextBtn.id = "next-question-btn";
            nextBtn.textContent = "Next Question";
            nextBtn.style.display = "block";
            nextBtn.style.marginTop = "20px";
            nextBtn.onclick = () => this.goToNextQuestion();
            videoContainer.appendChild(nextBtn);
        }

        goToNextQuestion() {
            this.waitingForNext = false;
            this.currentIndex++;
            this.renderQuestion();
        }

        parseText(text) {
            if (!text) return "";

            return text.replace(/\{([^}]+)\}/g, (match, content) => {
                const url = content.trim();
                const lower = url.toLowerCase();

                // Image
                if (lower.match(/\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/)) {
                    const filename = url.split("/").pop().split("?")[0];
                    const alt = filename.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]/g, " ").trim();
                    const altText = alt.charAt(0).toUpperCase() + alt.slice(1);
                    return `<img src="${url}" alt="${altText}" class="q-img">`;
                }

                // YouTube
                if (lower.includes("youtu")) {
                    const embed = url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/");
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
    }

    global.Quiz = Quiz;

})(window);
