'use strict';
/* Study room: AI Engineer Skills Map and Interview Prep. Hand-built, free.
   It describes what employers commonly ask for in AI and data roles and maps each skill to a Dhruv Patel Academy module. Job markets change quickly: the skill lists are a guide drawn from typical role
   descriptions, not statistics. Check current job posts in your own market before you decide what to learn next. */
DSQ.studio = DSQ.studio || {};
DSQ.studio.industry = {
  id: 'industry', icon: '🧭', title: 'AI Skills Map', starter: 'import numpy as np',
  subtitle: 'What AI, data and software roles usually ask for, which Dhruv Patel Academy module teaches each skill, a self-check that finds your gaps, interview preparation and portfolio projects that prove the skills.',
  words: ['Skills, mapped.', 'Gaps, found.', 'Proof, built.'],
  about: 'The lists here reflect what role descriptions **commonly** ask for. Markets, tools and titles change, so treat this as a guide and compare it with current job posts where you live. Nothing here is a promise about jobs or pay.',
  sections: [
    {
      id: 'roles', icon: '🗺️', title: 'Roles and the skills they use', sub: 'Five common roles and how much of each skill they typically lean on.',
      objectives: ['Tell five common roles apart by the work they do', 'See which skills are core for each', 'Find the Dhruv Patel Academy module for each skill', 'Choose a first target role'],
      simple: 'Job titles blur, so look at the **work**. A data analyst answers business questions with data. A data scientist builds models and experiments. An ML engineer puts models into production. An AI application engineer builds products around language models. A backend or platform engineer builds the services and pipelines they all run on.',
      blocks: [
        { t: 'h2', text: 'How much each role leans on each skill' },
        { t: 'p', text: '**●** core (you cannot do the job without it) · **◐** common · **○** helpful. This is a typical pattern, not a rule.' },
        { t: 'table', head: ['Skill', 'Data analyst', 'Data scientist', 'ML engineer', 'AI app engineer', 'Backend / platform'], rows: [['Python and clean code', '◐', '●', '●', '●', '●'], ['SQL and data modelling', '●', '●', '◐', '◐', '●'], ['Data cleaning and EDA', '●', '●', '◐', '◐', '○'], ['Statistics and experiments', '●', '●', '◐', '○', '○'], ['Machine learning (scikit-learn)', '○', '●', '●', '◐', '○'], ['Deep learning (PyTorch)', '○', '◐', '●', '○', '○'], ['LLM apps, prompts and tools', '○', '◐', '◐', '●', '○'], ['RAG and vector databases', '○', '○', '◐', '●', '○'], ['Evaluation and guardrails', '○', '◐', '●', '●', '○'], ['APIs (FastAPI, Django)', '○', '○', '●', '●', '●'], ['Docker, Git, CI/CD, cloud', '○', '◐', '●', '●', '●'], ['Data pipelines and orchestration', '◐', '◐', '●', '○', '●'], ['Dashboards and communication', '●', '●', '○', '◐', '○']] },
        { t: 'h2', text: 'Where to learn each skill here' },
        { t: 'table', head: ['Skill', 'Dhruv Patel Academy module'], rows: [['Python, clean code', 'Python for Data Science'], ['SQL', 'SQL for Data Science'], ['Cleaning and EDA', 'Data Reading and Cleaning (the flagship)'], ['Statistics and experiments', 'Statistics; Experiments and Causal Thinking; Uncertainty'], ['Machine learning', 'Machine Learning with scikit-learn; Time Series'], ['Deep learning', 'Neural Networks; PyTorch; Computer Vision; NLP'], ['LLMs and GenAI', 'Generative AI Foundations; Tokenization; LLM Inference; Fine-tuning'], ['RAG, vector databases, agents', 'Vector Databases; LLMs, Embeddings and RAG; LLM Apps; Agentic AI'], ['Evals, safety, governance', 'LLM Evaluation and Guardrails; Responsible AI'], ['APIs and web', 'FastAPI; Django; HTTP, REST and JSON; Web Development'], ['Ship and operate', 'Docker, Git and Linux; DevOps; MLOps; System Design; Data Pipelines']] },
        { t: 'links', items: [['Open the Vector Databases module', '#/m/vectordb'], ['Open the LLM Apps module', '#/m/llmapps'], ['Open the FastAPI module', '#/m/fastapi'], ['Open the MLOps module', '#/m/mlops']] },
        { t: 'warn', items: ['Collecting tools instead of skills. A tool changes every year; "retrieve the right passage and prove it with an eval" does not.', 'Skipping the base. SQL, Python and statistics sit under every role on the list.', 'Believing one title equals one job. Read the **tasks** in the posting.'] },
      ],
      quiz: [
        { q: 'Which skill is core for almost every role in the table?', o: ['Deep learning', 'Python or SQL with clean data work', 'Kubernetes', 'Computer vision'], a: 1, w: 'Python and SQL appear as core or common in every role listed.' },
        { q: 'What is the best way to read a job title?', o: ['Trust it', 'Read the listed tasks and the tools used for them', 'Ignore the posting', 'Count the buzzwords'], a: 1, w: 'Titles are inconsistent; tasks tell you the work.' },
        { q: 'An AI application engineer leans most on which pair of skills?', o: ['Dashboards and statistics', 'LLM apps with RAG and vector search, plus evaluation', 'Pure maths', 'Hardware'], a: 1, w: 'They build products around language models and must evaluate and guard them.' },
        { q: 'Why check job posts in your own market?', o: ['To copy them', 'Demand differs by place and changes over time', 'It is required', 'Posts are always wrong'], a: 1, w: 'This room is a guide; your market is the evidence.' },
      ],
    },
    {
      id: 'selfcheck', icon: '🧪', title: 'Self-check: find your gaps', sub: 'Tick what you can honestly do today. The code scores each role and names the modules that close the biggest gaps.',
      objectives: ['Describe your skills in terms of things you can do', 'See your coverage for each role', 'Pick the next three modules to study'],
      simple: 'A skill is something you can **do**, not something you have heard of. The checklist below uses small, testable abilities. Tick only the ones you could do now without looking them up, and the page shows where you stand for each role.',
      blocks: [
        { t: 'lab', title: 'Skill self-check', controls: [
          { id: 's_py', type: 'check', label: 'I can write functions and loops in Python and read a traceback', value: true },
          { id: 's_sql', type: 'check', label: 'I can write a SQL query with a join and a GROUP BY', value: false },
          { id: 's_clean', type: 'check', label: 'I can find and fix missing values, duplicates and wrong types in a table', value: false },
          { id: 's_stat', type: 'check', label: 'I can explain a p-value and design a fair A/B test', value: false },
          { id: 's_ml', type: 'check', label: 'I can train and honestly evaluate a model with a train/test split', value: false },
          { id: 's_dl', type: 'check', label: 'I can train a small neural network in PyTorch', value: false },
          { id: 's_llm', type: 'check', label: 'I can call a model with tools and validate its structured output', value: false },
          { id: 's_rag', type: 'check', label: 'I can build retrieval over my own documents and measure recall', value: false },
          { id: 's_eval', type: 'check', label: 'I can build an eval set and compare two prompts with it', value: false },
          { id: 's_api', type: 'check', label: 'I can build and test an API with validation and auth', value: false },
          { id: 's_ship', type: 'check', label: 'I can containerise an app and describe its CI pipeline', value: false },
          { id: 's_pipe', type: 'check', label: 'I can schedule a data pipeline with retries and checks', value: false },
          { id: 's_comm', type: 'check', label: 'I can turn an analysis into a chart and a one-page recommendation', value: false }],
          code: 'have = {"py": {{s_py}}, "sql": {{s_sql}}, "clean": {{s_clean}}, "stat": {{s_stat}}, "ml": {{s_ml}}, "dl": {{s_dl}}, "llm": {{s_llm}}, "rag": {{s_rag}}, "eval": {{s_eval}}, "api": {{s_api}}, "ship": {{s_ship}}, "pipe": {{s_pipe}}, "comm": {{s_comm}}}\nW = {\n    "Data analyst":        {"py": 2, "sql": 3, "clean": 3, "stat": 3, "ml": 1, "comm": 3, "pipe": 2},\n    "Data scientist":      {"py": 3, "sql": 3, "clean": 3, "stat": 3, "ml": 3, "dl": 2, "comm": 3, "eval": 2, "ship": 1},\n    "ML engineer":         {"py": 3, "sql": 2, "clean": 2, "stat": 2, "ml": 3, "dl": 3, "eval": 3, "api": 3, "ship": 3, "pipe": 3},\n    "AI app engineer":     {"py": 3, "sql": 2, "llm": 3, "rag": 3, "eval": 3, "api": 3, "ship": 3, "clean": 2},\n    "Backend / platform":  {"py": 3, "sql": 3, "api": 3, "ship": 3, "pipe": 3},\n}\nMODULE = {"py": "Python", "sql": "SQL", "clean": "Data Reading and Cleaning", "stat": "Statistics / Experiments", "ml": "Machine Learning", "dl": "PyTorch / Neural Networks", "llm": "LLM Apps", "rag": "Vector Databases + RAG", "eval": "LLM Evaluation and Guardrails", "api": "FastAPI", "ship": "Docker, Git and CI / MLOps", "pipe": "Data Pipelines", "comm": "Content + Dashboards (Analytics)"}\nprint("coverage for each role (weighted by how much the role needs each skill):")\nbest = {}\nfor role, need in W.items():\n    got = sum(w for k, w in need.items() if have[k])\n    tot = sum(need.values())\n    best[role] = got / tot\n    print(f"  {role:20s} {got / tot:4.0%}  " + "#" * int(20 * got / tot))\ntarget = max(best, key=best.get)\ngaps = sorted([(w, k) for k, w in W[target].items() if not have[k]], reverse=True)[:3]\nprint()\nprint("closest role today:", target)\nprint("next modules to study:", ", ".join(MODULE[k] for w, k in gaps) if gaps else "none: build a portfolio project (see section 4)")', note: 'The weights are a simple model of the table in section 1, so the percentages are a guide, not a grade. The honest use: tick only what you could do today, then study the gaps for the role you want, and prove each new skill with a project.' },
      ],
      quiz: [
        { q: 'Which statement is a good "I can" skill?', o: ['I have heard of RAG', 'I can build retrieval over my own documents and measure recall', 'I like AI', 'I watched a video'], a: 1, w: 'A skill is something you can do and show.' },
        { q: 'What should you do with the gaps the check finds?', o: ['Ignore them', 'Study the modules named, and prove each skill with a small project', 'Collect certificates only', 'Apply to every job'], a: 1, w: 'Study, then prove it.' },
        { q: 'Why are the percentages only a guide?', o: ['They are random', 'The weights are a simple model of typical roles, and every employer differs', 'They are secret', 'They cannot change'], a: 1, w: 'Roles vary by company; a model of them is approximate.' },
        { q: 'You score 90% for "Backend / platform" but want to be a data scientist. What helps most?', o: ['Nothing', 'Study the data scientist gaps: statistics, ML and communication', 'More Docker', 'Change the weights'], a: 1, w: 'Target the role you want, not the one you already match.' },
      ],
    },
    {
      id: 'interview', icon: '🎤', title: 'Interview preparation', sub: 'The questions that come up again and again, and what a strong answer contains.',
      objectives: ['Answer the common technical questions in your own words', 'Structure an answer to a system design question', 'Explain a project with problem, method, result and lesson'],
      simple: 'Interviews test whether you can **reason out loud**, not whether you recite. A strong answer states the goal, names the trade-off, gives a small example and says how you would measure it. Practise by explaining to a friend, then by writing the answer in four sentences.',
      blocks: [
        { t: 'h2', text: 'Questions and what a strong answer contains' },
        { t: 'table', head: ['Question', 'A strong answer includes'], rows: [['What is overfitting and how do you detect it?', 'a model that fits training data but not new data; compare train and validation scores; fixes: more data, simpler model, regularisation, early stopping'], ['How do you handle missing data?', 'ask why it is missing; options and their risks (drop, impute, flag); never leak test information into the fill value'], ['Explain precision and recall. When would you favour each?', 'the two definitions; a cost example (spam filter vs cancer screening); the threshold trade-off'], ['How would you A/B test a new checkout page?', 'one metric decided in advance; sample size from the expected lift; run whole weeks; do not peek; look at effect size, not only p'], ['What is the difference between a view and a copy in pandas or NumPy?', 'shared memory versus independent; where each appears; how to check'], ['Why do we split data into train, validation and test?', 'tuning on validation, one final unbiased check on test; leakage risks'], ['How does RAG work and where does it fail?', 'chunk, embed, retrieve, generate with sources; failures: bad chunks, missing filters, wrong embedding model, poor retrieval; measure recall and answer quality separately'], ['How would you reduce hallucinations?', 'ground answers in retrieved sources and cite them; allow "I do not know"; evaluate on known answers; constrain output formats'], ['What is a vector database and when is plain Postgres enough?', 'embeddings plus an index for nearest-neighbour search; pgvector is often enough for millions of vectors and one system to run'], ['How do you evaluate an LLM application?', 'a fixed test set, automatic checks and human review, tracked per change; judge-model caveats'], ['How do you deploy a model as an API?', 'load once, validate input, version the model, health checks, timeouts, tests, containers, monitoring and a rollback plan'], ['What happens when you type a URL and press Enter?', 'DNS, connection, TLS, HTTP request, server work, response, rendering; where caching and CDNs fit']] },
        { t: 'h2', text: 'A frame for system design questions' },
        { t: 'pipeline', nodes: [['Clarify', 'users, scale, goals'], ['Data', 'sources, quality, privacy'], ['Core design', 'components and flow'], ['Trade-offs', 'cost, latency, accuracy'], ['Measure', 'metrics and evals'], ['Operate', 'monitoring, failure, rollout']] },
        { t: 'cards', cols: 'g2', items: [['📚', 'Design a document Q&A assistant', 'Clarify who asks and what they may see. Ingest and chunk with metadata. Hybrid retrieval with filters, rerank, generate with citations. Evaluate recall and answers. Guard against injection. Monitor cost and failures.'], ['🛒', 'Design a recommendation feature', 'Define the goal and the metric. Candidate generation and ranking. Cold start. Offline evaluation, then an A/B test. Feedback loops and fairness. Latency budget and caching.']] },
        { t: 'h2', text: 'Explain a project in four sentences' },
        { t: 'lab', title: 'Project explainer check', controls: [{ id: 'story', type: 'textarea', rows: 5, label: 'your project in 3 to 6 sentences', value: 'I built a support assistant for our docs. Customers could not find answers, so I split the docs into chunks, added hybrid search and cited sources. I measured recall@5 on 80 real questions: it rose from 61% to 84%. I learned that chunking mattered more than the model.', alt: ['I made an AI thing with a model.'] }],
          code: 'story = {{story|py}}\nlow = story.lower()\nhas_number = any(c.isdigit() for c in story)\nwords = story.split()\nchecks = {\n    "names a problem (why it mattered)": any(w in low for w in ["could not", "problem", "slow", "failed", "needed", "wanted", "because"]),\n    "says what YOU did (a method)": any(w in low for w in ["i built", "i split", "i added", "i trained", "i designed", "i measured", "i wrote", "i made"]),\n    "has a result with a number": has_number and any(w in low for w in ["rose", "fell", "from", "to ", "%", "reduced", "improved"]),\n    "says what you learned": any(w in low for w in ["learned", "lesson", "realised", "found that", "mattered"]),\n    "is short enough (30 to 120 words)": 30 <= len(words) <= 120,\n}\nprint(f"{len(words)} words")\nfor name, ok in checks.items():\n    print("YES" if ok else "NO ", "-", name)\nprint(f"{sum(checks.values())} of {len(checks)} elements present")', note: 'A rough checker for the **shape** of the story (problem, method, result, lesson). It cannot judge whether the work is good or true: the interviewer will ask a follow-up about every number, so only claim what you measured.' },
        { t: 'warn', items: ['Reciting definitions. Give an example from your own work after the definition.', 'Claiming a number you cannot explain. Say how you measured it.', 'Saying you used a tool without saying **why** it was the right choice.', 'Never saying "I do not know, but here is how I would find out". It is a strong answer.'] },
      ],
      quiz: [
        { q: 'What makes an answer to "explain overfitting" strong?', o: ['A long definition', 'The idea, how to detect it, how to fix it, and an example', 'Using jargon', 'Saying it is bad'], a: 1, w: 'Definition, detection, remedy and an example.' },
        { q: 'In a system design question, what comes first?', o: ['The database', 'Clarifying users, scale and goals', 'The model', 'The cloud provider'], a: 1, w: 'The design depends on the requirements; ask first.' },
        { q: 'The interviewer asks about a number in your project. What should you be ready to explain?', o: ['Nothing', 'How you measured it and on what data', 'Who else got it', 'Why it is round'], a: 1, w: 'Every claim needs a source.' },
        { q: 'You do not know an answer. What is a strong response?', o: ['Guess confidently', 'Say what you do not know and how you would find out', 'Change the subject', 'Stay silent'], a: 1, w: 'Honest reasoning beats a bluff.' },
      ],
    },
    {
      id: 'portfolio', icon: '🏗️', title: 'Build a portfolio that proves it', sub: 'Five project briefs that map to the skills, and a rubric to score your own work honestly.',
      objectives: ['Pick a project that proves a skill an employer asks for', 'Know what "done" looks like for each', 'Score your project against a rubric'],
      simple: 'A portfolio is **evidence**. One finished project with a clear problem, honest measurements and a short write-up is worth more than ten half-built notebooks. Each brief below names the skills it proves and the proof a reviewer will look for.',
      blocks: [
        { t: 'table', head: ['Project', 'Skills it proves', 'Proof a reviewer looks for'], rows: [['A cleaning pipeline for a messy public dataset', 'Python, pandas, validation, tests', 'a run report: rows in and out, rejected rows and why, checks that fail loudly'], ['A churn or price model with an honest evaluation', 'ML, statistics, evaluation', 'a baseline, a leak-free split, metrics with uncertainty, a model card'], ['Question answering over documents (RAG)', 'embeddings, vector search, hybrid search, evals', 'a question set, recall and answer scores before and after each change, citations in answers'], ['A model or LLM behind an API', 'FastAPI, validation, auth, Docker, tests', 'a repository with tests, a container, a health check, a short architecture note'], ['A tool-using agent with guardrails', 'LLM apps, graphs, safety, cost', 'a step limit, an allow-list of tools, a cost log, failure cases you found and handled']] },
        { t: 'h2', text: 'Score a project' },
        { t: 'lab', title: 'Portfolio rubric', controls: [
          { id: 'r_problem', type: 'check', label: 'It starts from a real problem someone has, stated in one sentence', value: true },
          { id: 'r_data', type: 'check', label: 'The data source is public or described, and its limits are stated', value: true },
          { id: 'r_base', type: 'check', label: 'There is a simple baseline to beat', value: false },
          { id: 'r_eval', type: 'check', label: 'Results are measured on data the work never saw, with a number I can explain', value: false },
          { id: 'r_fail', type: 'check', label: 'It shows failures and what I did about them', value: false },
          { id: 'r_code', type: 'check', label: 'The code runs from a fresh clone with one command, and has tests', value: false },
          { id: 'r_ship', type: 'check', label: 'It is deployed or runnable in a container', value: false },
          { id: 'r_write', type: 'check', label: 'A one-page write-up says what I did, the result and what I would do next', value: false }],
          code: 'items = {"problem": {{r_problem}}, "data": {{r_data}}, "baseline": {{r_base}}, "evaluation": {{r_eval}}, "failures": {{r_fail}}, "code": {{r_code}}, "ship": {{r_ship}}, "write-up": {{r_write}}}\nweight = {"problem": 1, "data": 1, "baseline": 2, "evaluation": 3, "failures": 2, "code": 2, "ship": 1, "write-up": 2}\nscore = sum(weight[k] for k, v in items.items() if v)\ntotal = sum(weight.values())\nprint(f"score {score} / {total}  ({score / total:.0%})")\nmissing = sorted([(weight[k], k) for k, v in items.items() if not v], reverse=True)\nprint("add next:", ", ".join(k for w, k in missing[:3]) if missing else "nothing: publish it and write about it")', note: 'Evaluation, failures, code quality and the write-up carry the weight, because they are what separates a project from a demo. Add the heaviest missing item next.' },
        { t: 'activity', title: '🧑‍🏫 Your next step', text: 'Run the self-check, choose the role you want, pick the project from the table that proves its biggest gap, and write the one-sentence problem **before** you write any code. Then build it in the matching Dhruv Patel Academy module and publish it with a write-up.' },
      ],
      quiz: [
        { q: 'Which is stronger portfolio evidence?', o: ['Ten unfinished notebooks', 'One finished project with honest measurements and a write-up', 'A list of courses', 'A model with no test data'], a: 1, w: 'Finished, measured and explained beats many fragments.' },
        { q: 'What should a RAG project show?', o: ['Only a demo video', 'A question set with recall and answer scores before and after changes, and citations', 'A big model', 'A pretty interface only'], a: 1, w: 'Measurements are the proof.' },
        { q: 'Why include failure cases?', o: ['To pad the report', 'They show you understand limits and how to handle them', 'Employers like errors', 'Required by law'], a: 1, w: 'Real systems fail; showing how you handled it is credible.' },
        { q: 'You must choose a project. What comes first?', o: ['The tool', 'The one-sentence problem', 'The logo', 'The cloud provider'], a: 1, w: 'A clear problem decides everything after it.' },
      ],
    },
  ],
  cheat: [
    ['Coverage of a role', 'sum(weight for skills you have) / sum(all weights)'], ['Hybrid search score', 'rrf = sum(1 / (60 + rank))'], ['Recall@k', 'len(set(true[:k]) & set(found[:k])) / k'], ['A/B sample size', '(za + zb) ** 2 * (p1*(1-p1) + p2*(1-p2)) / (p2 - p1) ** 2'], ['Explain a project', 'problem, what I did, result with a number, what I learned'], ['System design frame', 'clarify, data, core design, trade-offs, measure, operate'],
  ],
  glossary: [
    ['ML engineer', 'Builds and runs the systems that train, serve and monitor models.'], ['AI application engineer', 'Builds products around language models: prompts, retrieval, tools, evaluation.'], ['data scientist', 'Frames questions, builds models and experiments, and explains the results.'], ['data analyst', 'Answers business questions with data, queries and charts.'], ['MLOps', 'The practices for deploying, monitoring and updating models reliably.'],
    ['RAG', 'Retrieval-augmented generation: fetch relevant text and give it to the model with the question.'], ['eval set', 'A fixed set of inputs with the answers you want, used to score changes.'], ['portfolio', 'Finished projects that prove your skills.'], ['baseline', 'A simple method that a better one must beat.'],
  ],
  exam: [
    'Pick a target role. List its five most important skills and the Dhruv Patel Academy module for each.',
    'Explain overfitting, precision and recall, and a fair A/B test in four sentences each, with an example from your own work.',
    'Design a document Q&A assistant: components, data flow, how you would measure quality and what could go wrong.',
    'Describe one portfolio project that would prove a skill you lack today, and its definition of done.',
    'Write a four-sentence description of a project you finished: problem, method, a measured result, a lesson.',
  ],
};
