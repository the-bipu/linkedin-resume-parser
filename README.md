# 🚀 LinkedIn Resume Parser

A **fast, privacy-first, and deterministic LinkedIn Resume Parser** built with **Next.js** that transforms a **LinkedIn "Save to PDF" export** into a structured, editable profile.

Unlike most resume parsers, this project **does not use AI or LLMs**. Instead, it relies on **layout heuristics** and **deterministic parsing**, making it **free, consistent, explainable, and privacy-friendly**.

---

## ✨ Why This Project?

Most modern resume parsers:

* 🤖 Upload your resume to an AI model
* 💰 Consume expensive API tokens
* 🌐 Require an internet connection
* 🎲 May produce different results for the same document

This project follows a different philosophy.

✅ No AI
✅ No token costs
✅ No inference APIs
✅ Deterministic results
✅ Privacy-first architecture

---

## ⚡ Features

* 📄 Upload LinkedIn PDF exports ("Save to PDF")
* 🧩 Automatically parse profile information
* ✏️ Editable structured profile view
* 🔍 Deterministic layout-based extraction
* ⚡ Fast client-side PDF processing
* 🔒 Privacy-focused architecture
* 💸 Zero AI costs
* 🧠 No LLM dependencies
* 📦 Clean and modular codebase

---

## 📑 Parsed Information

The parser currently extracts the following information:

* 👤 Full Name
* 📧 Email Address
* 📱 Phone Number
* 🔗 LinkedIn Profile URL
* 📍 Location
* 🏢 Current Company
* 📝 Professional Summary
* 💼 Work Experience
* 🎓 Education
* 🛠 Top Skills
* 🏅 Certifications
* 🏆 Honors & Awards

---

## ⚙️ How It Works

```text
LinkedIn PDF
       │
       ▼
Client-side PDF Processing
       │
       ▼
Layout Heuristic Engine
       │
       ▼
Structured JSON Data
       │
       ▼
Editable Profile Interface
```

The parser identifies LinkedIn's document structure using deterministic rules instead of relying on machine learning or AI models.

---

## 🛠 Tech Stack

* **Next.js**
* **React**
* **TypeScript**
* **PDF.js / PDF Parsing Library**
* **Custom Layout Heuristic Engine**
* **CSS / Tailwind CSS (if applicable)**

---

## 📂 Project Structure

```text
.
├── app/                 # Next.js App Router
├── components/          # Reusable UI components
├── lib/                 # Parsing logic & utilities
├── utils/               # Helper functions
├── public/              # Static assets
├── styles/              # Global styles
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## 🚀 Getting Started

Clone the repository

```bash
git clone https://github.com/your-username/linkedin-resume-parser.git
```

Move into the project

```bash
cd linkedin-resume-parser
```

Install dependencies

```bash
npm install
```

Start the development server

```bash
npm run dev
```

Open

```text
http://localhost:3000
```

---

## 📦 Available Scripts

| Command         | Description                  |
| --------------- | ---------------------------- |
| `npm run dev`   | Start development server     |
| `npm run build` | Build production application |
| `npm run start` | Start production server      |
| `npm run lint`  | Run ESLint                   |

---

## 🔒 Privacy First

This project is designed with privacy as a core principle.

* ✅ No AI models
* ✅ No OpenAI API
* ✅ No Gemini API
* ✅ No Claude API
* ✅ No token usage
* ✅ No inference costs
* ✅ PDF processed locally for parsing
* ✅ Deterministic extraction

Your LinkedIn PDF is parsed using document layout rules rather than being interpreted by an LLM.

---

## 🎯 Why Deterministic Parsing?

Instead of asking an AI to "guess" where information is located, this parser understands the structure of LinkedIn PDF exports.

This provides:

* Faster parsing
* Lower resource usage
* Consistent outputs
* Explainable extraction
* Zero hallucinations
* No recurring API costs

---

## 🚧 Current Status

### ✅ Completed

* LinkedIn PDF Upload
* PDF Parsing Engine
* Structured Profile Extraction
* Editable Profile View

### 🗺 Roadmap

* Export to JSON
* Export to PDF
* Export to DOCX
* Resume Health Score
* ATS Compatibility Checker
* Resume Templates
* Resume Comparison
* Portfolio Generator
* Public Resume Links
* Offline PWA Support

---

## ⚠️ Limitations

* Supports **LinkedIn "Save to PDF" exports only**
* Generic resume PDFs are not supported yet
* Parsing depends on the LinkedIn PDF layout remaining consistent

---

## 🤝 Contributing

Contributions are always welcome!

If you've found a parsing edge case or discovered a bug:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a Pull Request

If possible, include an anonymized LinkedIn PDF that reproduces the issue.

---

## 💡 Project Philosophy

> **Deterministic > Probabilistic**

Many document parsing problems don't require AI.

This project demonstrates that reliable, fast, and private document extraction can be achieved using thoughtfully engineered parsing rules instead of expensive language models.

---

## 📜 License

This project is licensed under the **MIT License**.

---

## ⭐ Support

If you found this project useful:

* ⭐ Star the repository
* 🐛 Report bugs
* 💡 Suggest new features
* 🤝 Contribute improvements

Every contribution helps make the parser better for everyone.