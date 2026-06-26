// This script fills your database with sample interview questions.
// Run it ONCE with: node seed.js

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Question = require("./models/Question");

dotenv.config();

const questions = [
  // ════════════════════════════════════
  // FRONTEND DEVELOPER
  // ════════════════════════════════════

  // -- MCQs --
  { role: "Frontend Developer", difficulty: "Easy", type: "mcq", category: "CSS",
    questionText: "Which CSS property is used to change the text color of an element?",
    options: ["text-color", "font-color", "color", "text-style"],
    correctOptionIndex: 2,
    explanation: "The `color` property sets the text color. `text-color` and `font-color` don't exist in CSS." },

  { role: "Frontend Developer", difficulty: "Easy", type: "mcq", category: "JavaScript",
    questionText: "Which keyword declares a variable that cannot be reassigned?",
    options: ["var", "let", "const", "static"],
    correctOptionIndex: 2,
    explanation: "`const` creates a binding that cannot be reassigned after declaration." },

  { role: "Frontend Developer", difficulty: "Medium", type: "mcq", category: "React",
    questionText: "Which React Hook is used to perform side effects in a functional component?",
    options: ["useState", "useEffect", "useMemo", "useRef"],
    correctOptionIndex: 1,
    explanation: "`useEffect` runs side effects (data fetching, subscriptions, DOM updates) after render." },

  { role: "Frontend Developer", difficulty: "Medium", type: "mcq", category: "React",
    questionText: "What does the Virtual DOM primarily help React do?",
    options: ["Style components", "Reduce direct DOM manipulation for better performance", "Manage routing", "Handle API calls"],
    correctOptionIndex: 1,
    explanation: "The Virtual DOM lets React calculate the minimal set of real DOM changes needed, which improves performance." },

  { role: "Frontend Developer", difficulty: "Hard", type: "mcq", category: "JavaScript",
    questionText: "What will `console.log(typeof NaN)` output?",
    options: ["'NaN'", "'undefined'", "'number'", "'object'"],
    correctOptionIndex: 2,
    explanation: "NaN is technically of type 'number' in JavaScript, even though it means 'Not a Number'." },

  // -- Descriptive --
  { role: "Frontend Developer", difficulty: "Easy", type: "descriptive", category: "HTML/CSS",
    questionText: "What is the difference between block, inline, and inline-block elements in CSS?" },
  { role: "Frontend Developer", difficulty: "Easy", type: "descriptive", category: "JavaScript",
    questionText: "What is the difference between let, const, and var in JavaScript?" },
  { role: "Frontend Developer", difficulty: "Medium", type: "descriptive", category: "React",
    questionText: "Explain the difference between useEffect and useLayoutEffect in React. When would you use each one?" },
  { role: "Frontend Developer", difficulty: "Medium", type: "descriptive", category: "JavaScript",
    questionText: "Explain event delegation in JavaScript with an example." },
  { role: "Frontend Developer", difficulty: "Hard", type: "descriptive", category: "React",
    questionText: "How would you optimize a React application that is re-rendering too often?" },
  { role: "Frontend Developer", difficulty: "Hard", type: "descriptive", category: "JavaScript",
    questionText: "Explain closures in JavaScript with a practical real-world example." },

  // ════════════════════════════════════
  // BACKEND DEVELOPER
  // ════════════════════════════════════

  // -- MCQs --
  { role: "Backend Developer", difficulty: "Easy", type: "mcq", category: "HTTP",
    questionText: "Which HTTP status code means 'Not Found'?",
    options: ["200", "301", "404", "500"],
    correctOptionIndex: 2,
    explanation: "404 means the requested resource could not be found on the server." },

  { role: "Backend Developer", difficulty: "Easy", type: "mcq", category: "Node.js",
    questionText: "Which of these is the package manager that comes bundled with Node.js?",
    options: ["yarn", "npm", "pip", "composer"],
    correctOptionIndex: 1,
    explanation: "npm (Node Package Manager) is installed automatically with Node.js." },

  { role: "Backend Developer", difficulty: "Medium", type: "mcq", category: "Database",
    questionText: "Which of these is a NoSQL database?",
    options: ["MySQL", "PostgreSQL", "MongoDB", "SQLite"],
    correctOptionIndex: 2,
    explanation: "MongoDB is a document-based NoSQL database; the others are relational (SQL) databases." },

  { role: "Backend Developer", difficulty: "Medium", type: "mcq", category: "API",
    questionText: "In REST APIs, which HTTP method is typically used to update an entire resource?",
    options: ["GET", "POST", "PUT", "DELETE"],
    correctOptionIndex: 2,
    explanation: "PUT is used to replace/update an entire resource at a known URL." },

  { role: "Backend Developer", difficulty: "Hard", type: "mcq", category: "Security",
    questionText: "What is the main purpose of hashing passwords before storing them?",
    options: ["To make them shorter", "To make them reversible for login", "To prevent storing plain-text passwords so they can't be read if leaked", "To encrypt them for transmission only"],
    correctOptionIndex: 2,
    explanation: "Hashing is one-way, so even if the database leaks, attackers can't directly read the original passwords." },

  // -- Descriptive --
  { role: "Backend Developer", difficulty: "Easy", type: "descriptive", category: "Node.js",
    questionText: "What is Node.js and why is it single-threaded?" },
  { role: "Backend Developer", difficulty: "Easy", type: "descriptive", category: "Database",
    questionText: "What is the difference between SQL and NoSQL databases?" },
  { role: "Backend Developer", difficulty: "Medium", type: "descriptive", category: "Node.js",
    questionText: "Explain the event loop in Node.js." },
  { role: "Backend Developer", difficulty: "Medium", type: "descriptive", category: "API",
    questionText: "How do you handle authentication in a REST API? Explain JWT." },
  { role: "Backend Developer", difficulty: "Hard", type: "descriptive", category: "System Design",
    questionText: "How would you design a rate limiter for an API?" },
  { role: "Backend Developer", difficulty: "Hard", type: "descriptive", category: "Scalability",
    questionText: "How would you scale a Node.js application to handle 1 million requests per day?" },

  // ════════════════════════════════════
  // FULL STACK DEVELOPER
  // ════════════════════════════════════

  // -- MCQs --
  { role: "Full Stack Developer", difficulty: "Easy", type: "mcq", category: "General",
    questionText: "In the MERN stack, what does the 'M' stand for?",
    options: ["MySQL", "MongoDB", "Material UI", "Mongoose only"],
    correctOptionIndex: 1,
    explanation: "MERN = MongoDB, Express, React, Node.js." },

  { role: "Full Stack Developer", difficulty: "Medium", type: "mcq", category: "Security",
    questionText: "What does CORS stand for?",
    options: ["Cross-Origin Resource Sharing", "Client Origin Request System", "Cross-Object Rendering Spec", "Cached Origin Response Sync"],
    correctOptionIndex: 0,
    explanation: "CORS (Cross-Origin Resource Sharing) controls which origins are allowed to access a server's resources." },

  { role: "Full Stack Developer", difficulty: "Medium", type: "mcq", category: "API",
    questionText: "Which of these is true about GraphQL compared to REST?",
    options: ["GraphQL only supports GET requests", "GraphQL lets clients request exactly the fields they need", "GraphQL cannot use authentication", "GraphQL replaces databases entirely"],
    correctOptionIndex: 1,
    explanation: "A key benefit of GraphQL is letting the client specify exactly which fields it wants, avoiding over-fetching." },

  { role: "Full Stack Developer", difficulty: "Hard", type: "mcq", category: "Performance",
    questionText: "Which caching strategy stores data closest to the user, e.g. in the browser?",
    options: ["Database caching", "CDN/Client-side caching", "Server-side caching only", "No caching needed"],
    correctOptionIndex: 1,
    explanation: "CDN and client-side (browser) caching store data physically closer to the user for the fastest retrieval." },

  // -- Descriptive --
  { role: "Full Stack Developer", difficulty: "Easy", type: "descriptive", category: "API",
    questionText: "What is the difference between REST and GraphQL?" },
  { role: "Full Stack Developer", difficulty: "Medium", type: "descriptive", category: "Architecture",
    questionText: "How does data flow from the database to the UI in a typical MERN application?" },
  { role: "Full Stack Developer", difficulty: "Medium", type: "descriptive", category: "Security",
    questionText: "How do you securely store and verify user passwords?" },
  { role: "Full Stack Developer", difficulty: "Hard", type: "descriptive", category: "System Design",
    questionText: "How would you design a real-time chat application from scratch?" },
  { role: "Full Stack Developer", difficulty: "Hard", type: "descriptive", category: "Performance",
    questionText: "How would you handle caching in a full stack application to improve performance?" },

  // ════════════════════════════════════
  // AI/ML ENGINEER
  // ════════════════════════════════════

  // -- MCQs --
  { role: "AI/ML Engineer", difficulty: "Easy", type: "mcq", category: "ML Basics",
    questionText: "Which type of learning uses labeled data?",
    options: ["Unsupervised learning", "Supervised learning", "Reinforcement learning", "Self-supervised learning only"],
    correctOptionIndex: 1,
    explanation: "Supervised learning trains models using input-output pairs (labeled data)." },

  { role: "AI/ML Engineer", difficulty: "Medium", type: "mcq", category: "ML Basics",
    questionText: "What does 'overfitting' mean in machine learning?",
    options: ["The model is too simple to learn patterns", "The model performs well on training data but poorly on new data", "The model trains too fast", "The dataset is too small to use"],
    correctOptionIndex: 1,
    explanation: "Overfitting happens when a model memorizes training data instead of learning generalizable patterns." },

  { role: "AI/ML Engineer", difficulty: "Hard", type: "mcq", category: "Deep Learning",
    questionText: "What is the primary purpose of an activation function in a neural network?",
    options: ["To speed up training only", "To introduce non-linearity so the network can learn complex patterns", "To reduce the dataset size", "To normalize input data"],
    correctOptionIndex: 1,
    explanation: "Activation functions introduce non-linearity, allowing neural networks to model complex, non-linear relationships." },

  // -- Descriptive --
  { role: "AI/ML Engineer", difficulty: "Easy", type: "descriptive", category: "ML Basics",
    questionText: "What is the difference between supervised and unsupervised learning?" },
  { role: "AI/ML Engineer", difficulty: "Medium", type: "descriptive", category: "Deep Learning",
    questionText: "Explain how a neural network learns through backpropagation." },
  { role: "AI/ML Engineer", difficulty: "Hard", type: "descriptive", category: "Deployment",
    questionText: "How would you deploy a machine learning model into production and monitor it?" },

  // ════════════════════════════════════
  // HR ROUND
  // ════════════════════════════════════

  // -- MCQs (workplace scenario judgment) --
  { role: "HR Round", difficulty: "Easy", type: "mcq", category: "Workplace Scenario",
    questionText: "Your manager gives you critical feedback in front of the team. What's the most professional immediate response?",
    options: ["Argue back to defend yourself", "Stay calm, listen, and discuss it privately afterward", "Ignore the feedback completely", "Complain to HR immediately"],
    correctOptionIndex: 1,
    explanation: "Staying calm and addressing it privately shows maturity and professionalism, even if the public feedback felt unfair." },

  { role: "HR Round", difficulty: "Medium", type: "mcq", category: "Workplace Scenario",
    questionText: "You disagree with a teammate's technical approach. What's the best first step?",
    options: ["Implement your own approach without telling anyone", "Discuss your concerns directly and constructively with them", "Escalate to the manager immediately", "Say nothing and let it fail"],
    correctOptionIndex: 1,
    explanation: "Direct, respectful communication is usually the best first step before escalating or acting unilaterally." },

  // -- Descriptive --
  { role: "HR Round", difficulty: "Easy", type: "descriptive", category: "Behavioural",
    questionText: "Tell me about yourself and your career goals." },
  { role: "HR Round", difficulty: "Easy", type: "descriptive", category: "Behavioural",
    questionText: "Why do you want to work for our company?" },
  { role: "HR Round", difficulty: "Medium", type: "descriptive", category: "Behavioural",
    questionText: "Tell me about a time you faced a conflict with a teammate and how you resolved it." },
  { role: "HR Round", difficulty: "Medium", type: "descriptive", category: "Behavioural",
    questionText: "Describe a situation where you failed at something. What did you learn?" },
  { role: "HR Round", difficulty: "Hard", type: "descriptive", category: "Behavioural",
    questionText: "Where do you see yourself in 5 years, and how does this role fit into that plan?" },

  // ════════════════════════════════════
  // DSA
  // ════════════════════════════════════

  // -- MCQs --
  { role: "DSA", difficulty: "Easy", type: "mcq", category: "Big-O",
    questionText: "What is the time complexity of searching for an element in a sorted array using binary search?",
    options: ["O(n)", "O(log n)", "O(n log n)", "O(1)"],
    correctOptionIndex: 1,
    explanation: "Binary search halves the search space each step, giving O(log n) time complexity." },

  { role: "DSA", difficulty: "Medium", type: "mcq", category: "Data Structures",
    questionText: "Which data structure uses FIFO (First In, First Out) order?",
    options: ["Stack", "Queue", "Binary Tree", "Hash Map"],
    correctOptionIndex: 1,
    explanation: "A Queue follows FIFO order — the first element added is the first one removed." },

  { role: "DSA", difficulty: "Hard", type: "mcq", category: "Big-O",
    questionText: "What is the worst-case time complexity of quicksort?",
    options: ["O(n log n)", "O(n)", "O(n²)", "O(log n)"],
    correctOptionIndex: 2,
    explanation: "Quicksort's worst case is O(n²), which happens with poor pivot choices (e.g. already sorted data with a naive pivot strategy)." },

  // -- Descriptive --
  { role: "DSA", difficulty: "Easy", type: "descriptive", category: "Arrays",
    questionText: "How do you reverse an array without using extra space?" },
  { role: "DSA", difficulty: "Medium", type: "descriptive", category: "Linked List",
    questionText: "How do you detect a cycle in a linked list?" },
  { role: "DSA", difficulty: "Hard", type: "descriptive", category: "Trees",
    questionText: "How would you find the lowest common ancestor of two nodes in a binary tree?" },
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");

    await Question.deleteMany({});
    await Question.insertMany(questions);

    const mcqCount = questions.filter((q) => q.type === "mcq").length;
    const descCount = questions.filter((q) => q.type === "descriptive").length;

    console.log(`✅ Seeded ${questions.length} questions successfully!`);
    console.log(`   → ${mcqCount} MCQs, ${descCount} Descriptive`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding error:", error);
    process.exit(1);
  }
};

seedDB();