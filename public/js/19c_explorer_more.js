'use strict';
/* =====================================================================
   Concept Explorer, batch two: pipeline, dataapp, scrape, experiment, recsys, sysdesign, devops, uiux, content, freelance.
   ===================================================================== */
Object.assign(EXPLORER, {
  sysdesign: N('A web-scale service (system design)', 'System design is deciding what boxes to draw and why. Start from the numbers (how many users, how much data, how fast), then add one piece at a time to remove the next bottleneck: <b>cache</b> for reads, <b>replicas</b> for availability, <b>shards</b> for size, <b>queues</b> for spikes.', [
    N('Client', 'A browser or app. It retries on failure, so your service must tolerate repeated requests.', [], { shape: 'page', out: 'request' }),
    N('CDN and load balancer', 'The CDN serves static files from a server near the user; the load balancer spreads requests across many identical app servers and drops unhealthy ones.', [N('CDN', 'Cached copies at the edge.', [], { shape: 'sphere', fx: 'pulse' }), N('Load balancer', 'Round robin or least connections.', [], { shape: 'frustum', r1: .55, r2: .25, axis: 'x', fx: 'pulse' })], { flow: true, shape: 'frustum', r1: .55, r2: .25, axis: 'x', fx: 'pulse', out: 'routed request' }),
    N('Stateless app servers', 'No user data kept in memory, so any server can answer any request and you scale by adding more of them.', [N('Server 1', 'Handles requests.', [], { shape: 'box', fx: 'pulse' }), N('Server 2', 'Handles requests.', [], { shape: 'box', fx: 'pulse' }), N('Server 3', 'Handles requests.', [], { shape: 'box', fx: 'pulse' })], { layout: 'row', shape: 'box', fx: 'pulse', out: 'query' }),
    N('Cache', 'Redis or memcached in memory: answers repeated reads in a millisecond and shields the database. The hard part is knowing when an entry is stale (TTL, invalidation).', [], { shape: 'db', fx: 'pulse', out: 'hit or miss' }),
    N('Database', 'The source of truth. Add <b>read replicas</b> to spread reads and for failover; add <b>shards</b> (split rows by a key) when one machine cannot hold the data.', [N('Primary', 'Takes the writes.', [], { shape: 'db' }), N('Replicas', 'Copies that serve reads.', [], { shape: 'db' }), N('Shards', 'Different slices of the data on different machines.', [], { shape: 'db' })], { flow: true, shape: 'db', out: 'rows' }),
    N('Queue and workers', 'Slow work (sending emails, building embeddings, resizing images) goes to a queue; workers take jobs at their own pace, so a spike makes the queue longer, not the service slower.', [N('Queue', 'Kafka, SQS, RabbitMQ.', [], { shape: 'matrix', m: [1, 6], fx: 'tokens' }), N('Workers', 'Process jobs; retry on failure.', [], { shape: 'ring', fx: 'spin' })], { flow: true, shape: 'matrix', m: [1, 6], fx: 'tokens', out: 'job done' }),
    N('Monitoring', 'Latency percentiles, error rate, saturation and queue depth. You cannot fix what you cannot see.', [], { shape: 'bars', fx: 'bars' }),
  ], { flow: true }),

  devops: N('DevOps pipeline: commit to production', 'DevOps joins development and operations so that changes reach users quickly <b>and</b> safely. Every step is automated, repeatable and visible: a commit triggers tests, a build, a deploy and monitoring.', [
    N('Commit and pull request', 'Small changes in a branch; a teammate reviews; automated checks must pass before merging.', [], { shape: 'page', out: 'change' }),
    N('Continuous integration', 'On every push: install, lint, unit tests, security scan. Independent jobs run in parallel to keep the feedback fast.', [N('Lint', 'Style and obvious bugs.', [], { shape: 'plate' }), N('Test', 'Unit and integration tests.', [], { shape: 'plate' }), N('Scan', 'Vulnerable dependencies.', [], { shape: 'plate' })], { layout: 'row', flow: true, shape: 'ring', fx: 'spin', out: 'green build' }),
    N('Build the artefact', 'Package the app into a versioned Docker image and push it to a registry. The same image goes to every environment.', [], { shape: 'box', out: 'image:1.4.2' }),
    N('Continuous delivery', 'Deploy to staging, run smoke tests, then to production with a safe strategy: rolling update, blue-green, or canary (a small share of users first).', [N('Staging', 'A copy of production.', [], { shape: 'box', fx: 'pulse' }), N('Canary 5%', 'Watch the error rate.', [], { shape: 'sphere', fx: 'pulse' }), N('Full rollout', 'Everyone.', [], { shape: 'frustum', r1: .3, r2: .6, axis: 'x', fx: 'pulse' })], { flow: true, shape: 'frustum', r1: .3, r2: .6, axis: 'x', fx: 'pulse', out: 'new version live' }),
    N('Kubernetes', 'You declare the <b>desired state</b> (3 replicas of image 1.4.2); a controller compares it with reality every few seconds and creates or removes pods to match.', [N('Deployment', 'The desired state.', [], { shape: 'page' }), N('Controller', 'Reconcile loop.', [], { shape: 'ring', fx: 'spin' }), N('Pods', 'Running containers.', [], { shape: 'box', fx: 'pulse' })], { flow: true, shape: 'ring', fx: 'spin', out: '3 pods running' }),
    N('Infrastructure as code', 'Servers, networks and databases are described in files (Terraform). <code>plan</code> shows what would change; <code>apply</code> makes it so. Review infrastructure like code.', [], { shape: 'page' }),
    N('Observe and respond', 'Metrics, logs and traces feed alerts tied to an <b>SLO</b> (for example 99.9% of requests under 300 ms). If the error budget burns too fast: roll back.', [], { shape: 'bars', fx: 'bars', out: 'alert or all clear' }),
  ], { flow: true, loop: true }),

  uiux: N('The design process (UI/UX)', 'UX is how something <b>works</b> for a person; UI is how it <b>looks</b> and responds. Good design is a loop of understanding a real person, making a rough version, and watching someone use it.', [
    N('Research', 'Interview and observe real users. Find the <b>job</b> they are trying to get done and what gets in the way.', [N('Interviews', 'Ask about the last time, not about opinions.', [], { shape: 'page' }), N('Analytics', 'Where do people drop out?', [], { shape: 'bars', fx: 'bars' })], { flow: true, shape: 'page', out: 'insights' }),
    N('Define', 'One sentence for the problem and a measurable success (task success rate, time to complete, satisfaction).', [], { shape: 'plate', out: 'problem statement' }),
    N('Ideate and structure', 'Sketch several ideas, choose the information order: what matters most goes first, related things sit together.', [N('Sketches', 'Many cheap options.', [], { shape: 'page' }), N('Hierarchy', 'Size, contrast and position say what is important.', [], { shape: 'frustum', r1: .55, r2: .25, axis: 'y', fx: 'pulse' })], { flow: true, shape: 'frustum', r1: .55, r2: .25, axis: 'y', fx: 'pulse', out: 'layout' }),
    N('Design the interface', 'Spacing on a scale, a limited type scale, a small palette with enough <b>contrast</b> (4.5:1 for body text), and states for hover, focus, error and empty.', [N('Type and spacing', 'A scale, not random sizes.', [], { shape: 'matrix', m: [3, 3] }), N('Colour and contrast', 'WCAG ratios.', [], { shape: 'ring', fx: 'spin' }), N('Accessibility', 'Keyboard, screen reader, colour-blind safe.', [], { shape: 'sphere', fx: 'pulse' })], { flow: true, shape: 'box', fx: 'pulse', out: 'prototype' }),
    N('Test with users', 'Five people doing real tasks reveal most problems. Count success, time and errors; measure satisfaction with the 10-question SUS.', [], { shape: 'sphere', fx: 'search', out: 'findings' }),
    N('Ship and measure', 'Release behind an experiment, watch the metrics (HEART: happiness, engagement, adoption, retention, task success), and return to research.', [], { shape: 'ring', fx: 'spin' }),
  ], { flow: true, loop: true }),

  pipeline: N('A data pipeline (ETL / ELT)', 'A pipeline moves data from where it is made to where it is useful, and cleans it on the way. Modern stacks load raw data first and transform it inside the warehouse (<b>ELT</b>), in layers: raw, cleaned, business-ready.', [
    N('Sources', 'Apps, databases, files, APIs, event streams. Each has its own format and its own way of being wrong.', [], { shape: 'db', out: 'raw records' }),
    N('Ingest', 'Pull or receive the data on a schedule or as a stream. Make it <b>idempotent</b>: running it twice must give the same result, not duplicates.', [N('Batch', 'Hourly or daily loads.', [], { shape: 'box', fx: 'tokens' }), N('Stream', 'Events as they happen (Kafka).', [], { shape: 'matrix', m: [1, 6], fx: 'tokens' })], { flow: true, shape: 'frustum', r1: .55, r2: .3, axis: 'x', fx: 'pulse', out: 'landed files' }),
    N('Bronze: raw', 'Store exactly what arrived. Never edit it: it is your replay button when logic changes.', [], { shape: 'db', out: 'raw table' }),
    N('Silver: cleaned', 'Remove duplicates, fix types, standardise names, handle nulls, apply tests (unique, not null, valid range).', [N('Deduplicate', 'Keep one row per key.', [], { shape: 'plate' }), N('Validate', 'Tests on every column that matters.', [], { shape: 'ring', fx: 'spin' })], { flow: true, shape: 'plate', out: 'clean table' }),
    N('Gold: business-ready', 'Joined, aggregated tables named for the question they answer (daily revenue, active users). dbt keeps each as a tested SQL model.', [], { shape: 'db', fx: 'pulse', out: 'metrics tables' }),
    N('Orchestrator', 'Airflow or Prefect runs the steps as a graph (DAG): dependencies, schedules, retries, alerts, backfills for past dates.', [], { shape: 'ring', fx: 'spin' }),
    N('Serve', 'Dashboards, notebooks, reverse-ETL back into apps, and feature tables for models.', [], { shape: 'sphere', fx: 'pulse' }),
  ], { flow: true }),

  dataapp: N('A data app (Streamlit style)', 'A data app turns an analysis into something other people can click. In Streamlit the whole script <b>reruns from the top</b> whenever a widget changes, so state and caching are the two ideas that matter.', [
    N('Widgets', 'Sliders, selectboxes and uploads return plain Python values.', [], { shape: 'plate', out: 'user choices' }),
    N('Script reruns', 'Any interaction reruns the script from the first line with the new widget values.', [], { shape: 'ring', fx: 'spin' }),
    N('Cache', '<code>@st.cache_data</code> remembers the result of a function for the same arguments, so loading data does not repeat on every click.', [N('Data cache', 'Keyed by the function arguments.', [], { shape: 'db', fx: 'pulse' }), N('Resource cache', 'One shared model or connection.', [], { shape: 'db' })], { flow: true, shape: 'db', fx: 'pulse', out: 'fast data' }),
    N('Compute', 'Filter, aggregate and model with pandas using the widget values.', [], { shape: 'box', fx: 'tokens', out: 'result table' }),
    N('Display', 'Charts, tables, metrics and layout (columns, tabs). Put the answer first and the controls beside it.', [], { shape: 'bars', fx: 'bars' }),
    N('Session state', '<code>st.session_state</code> keeps values between reruns (a counter, the chat history).', [], { shape: 'page' }),
    N('Deploy', 'Push to GitHub and deploy on Streamlit Community Cloud or a container; secrets go in environment variables.', [], { shape: 'sphere', fx: 'pulse' }),
  ], { flow: true, loop: true }),

  scrape: N('A polite web scraper', 'Scraping turns web pages into a table. A good scraper is <b>polite</b> (reads robots.txt, limits its speed, identifies itself), <b>robust</b> (selectors that survive small page changes) and <b>checked</b> (the data is validated).', [
    N('Check the rules', 'Read <code>robots.txt</code> and the terms of service. Prefer an official API or a downloadable file when one exists.', [], { shape: 'page', out: 'allowed paths' }),
    N('Fetch', 'Send an HTTP GET with a clear User-Agent, a timeout and a delay between requests; back off when you get 429 or 503.', [N('Request', 'Headers, timeout, retries.', [], { shape: 'plate' }), N('Rate limit', 'A pause between calls.', [], { shape: 'ring', fx: 'spin' })], { flow: true, shape: 'frustum', r1: .5, r2: .25, axis: 'x', fx: 'pulse', out: 'HTML' }),
    N('Parse', 'HTML is a tree (the DOM). A CSS selector or XPath walks the tree to the elements you want.', [N('DOM tree', 'html > body > div > h2.', [], { shape: 'box', fx: 'attention' }), N('Selector', '<code>div.card h2</code>', [], { shape: 'sphere', fx: 'search' })], { flow: true, shape: 'box', fx: 'attention', out: 'elements' }),
    N('Paginate', 'Follow the next-page link or increase the page parameter until the results stop.', [], { shape: 'matrix', m: [1, 6], fx: 'tokens' }),
    N('Clean', 'Strip whitespace, convert prices and dates to real types, remove duplicates, flag missing values.', [], { shape: 'plate', out: 'clean rows' }),
    N('Validate and store', 'Check counts and ranges against the page, then save to CSV or a database with the source URL and the time.', [], { shape: 'db', out: 'dataset' }),
  ], { flow: true }),

  experiment: N('An A/B experiment', 'An experiment answers "did my change cause this?" by randomly splitting users, so the only systematic difference between the groups is the change. Decide the test <b>before</b> you look at the data.', [
    N('Hypothesis and metric', 'One primary metric (conversion), a guardrail (page speed) and the smallest effect worth acting on.', [], { shape: 'page', out: 'plan' }),
    N('Sample size and power', 'Smaller effects need more users. Fix the sample size in advance from the baseline rate, the effect and the power (80%).', [], { shape: 'bars', fx: 'bars', out: 'n per group' }),
    N('Randomise', 'Assign each user to A or B by hashing the user id, so they always see the same version.', [N('Group A', 'Control.', [], { shape: 'box', fx: 'pulse' }), N('Group B', 'Treatment.', [], { shape: 'box', fx: 'pulse' })], { layout: 'row', flow: true, shape: 'ring', fx: 'spin', out: 'two groups' }),
    N('Run to the planned end', 'Peeking and stopping the moment p &lt; 0.05 inflates false positives. Run the full period (whole weeks).', [], { shape: 'sphere', fx: 'pulse' }),
    N('Analyse', 'Compare rates with a z-test or a Bayesian posterior; report the difference with a confidence interval, not only a p-value.', [], { shape: 'bars', fx: 'bars', out: 'effect + interval' }),
    N('Decide', 'Ship, stop or iterate. A result that is statistically significant but too small to matter is a "no".', [], { shape: 'sphere', fx: 'pulse' }),
  ], { flow: true }),

  recsys: N('A recommender system', 'A recommender picks a few items out of millions for each person. Real systems work in stages so that cheap steps narrow the list before expensive ones rank it.', [
    N('Signals', 'Clicks, purchases, ratings and watch time per user and item. Implicit signals are plentiful but noisy.', [], { shape: 'db', out: 'interactions' }),
    N('Candidate generation', 'From millions to a few hundred quickly: popular items, items similar to what you liked (collaborative filtering), nearest neighbours in an embedding space.', [N('Item-item similarity', 'People who liked A also liked B.', [], { shape: 'matrix', m: [3, 3] }), N('Vector search', 'Nearest item embeddings.', [], { shape: 'sphere', fx: 'search' })], { flow: true, shape: 'frustum', r1: .6, r2: .25, axis: 'x', fx: 'pulse', out: '~500 candidates' }),
    N('Ranking', 'A model scores each candidate for this user (probability of click or watch). Features: user, item, context.', [], { shape: 'box', fx: 'attention', out: 'scores' }),
    N('Re-rank', 'Business rules and diversity: remove duplicates, mix categories, hide what was just seen, add new items to learn about them.', [], { shape: 'ring', fx: 'spin', out: 'top 10' }),
    N('Show and log', 'Display the list and log what was shown and what was clicked: the training data for next time.', [], { shape: 'page' }),
    N('Evaluate', 'Offline: precision@k, recall@k, NDCG. Online: an A/B test on engagement. Watch for feedback loops that narrow what people see.', [], { shape: 'bars', fx: 'bars' }),
  ], { flow: true, loop: true }),

  content: N('A content system for data people', 'Content works when it is made by a system, not by inspiration. Start from one real project, turn it into several pieces, publish on a rhythm and read the numbers.', [
    N('Project or lesson', 'The raw material: something you built, an error you fixed, a chart that surprised you.', [], { shape: 'db', out: 'raw idea' }),
    N('Angle and hook', 'Who is it for and what do they get? The first line decides whether anyone reads the rest.', [], { shape: 'plate', out: 'hook' }),
    N('Draft the pieces', 'One idea becomes a long post, a short post, a carousel and a short video. Show the chart, then the lesson.', [N('Long post', 'Story, result, how.', [], { shape: 'page' }), N('Carousel', 'One idea per slide.', [], { shape: 'matrix', m: [1, 5] }), N('Short video', 'Hook in 3 seconds.', [], { shape: 'sphere', fx: 'pulse' })], { flow: true, shape: 'page', out: 'drafts' }),
    N('Publish on a schedule', 'A steady rhythm beats bursts. Batch the writing, schedule the posting.', [], { shape: 'ring', fx: 'spin' }),
    N('Measure', 'Reach, saves, comments and profile visits per post. Compare formats like an experiment, not by feeling.', [], { shape: 'bars', fx: 'bars', out: 'what worked' }),
    N('Repeat what worked', 'Do more of the top 20% of formats and topics; retire the rest.', [], { shape: 'sphere', fx: 'pulse' }),
  ], { flow: true, loop: true }),

  freelance: N('A freelance project, start to finish', 'Freelancing is a pipeline: people find you, you agree what to build and for how much, you deliver in steps, and you get paid and asked for a referral.', [
    N('Find leads', 'Referrals, your posts and portfolio, and targeted outreach. Pick a niche so people know exactly what you do.', [], { shape: 'sphere', fx: 'search', out: 'leads' }),
    N('Discovery call', 'Ask about the goal, the data, the deadline and the budget. Restate the problem in your own words.', [], { shape: 'page', out: 'requirements' }),
    N('Scope and price', 'Break the work into deliverables and estimate each (best, likely, worst). Price by project or value, with a buffer and a clear list of what is not included.', [N('Estimate', '(best + 4 x likely + worst) / 6.', [], { shape: 'bars', fx: 'bars' }), N('Price', 'Fixed fee, day rate or retainer.', [], { shape: 'plate' })], { flow: true, shape: 'bars', fx: 'bars', out: 'proposal' }),
    N('Contract and deposit', 'Scope, timeline, payment terms, ownership and revisions in writing. A deposit before you start.', [], { shape: 'page' }),
    N('Deliver in milestones', 'Short check-ins with something to look at each time; changes go through a change request, not silently into the scope.', [], { shape: 'ring', fx: 'spin', out: 'milestone' }),
    N('Invoice and handover', 'Send the invoice on delivery, hand over code, data and a short guide.', [], { shape: 'page' }),
    N('Referral and case study', 'Ask for feedback, a testimonial and an introduction; write the case study with real numbers (with permission).', [], { shape: 'sphere', fx: 'pulse' }),
  ], { flow: true, loop: true }),
});
Object.assign(EXPLORER_META, {
  sysdesign: ['System design: a web-scale service', 'CDN, load balancer, stateless servers, cache, replicas, shards, queue.'], devops: ['DevOps: commit to production', 'CI, build, canary deploy, Kubernetes, infrastructure as code, SLOs.'], uiux: ['UI/UX design process', 'Research, define, ideate, design, test, ship.'],
  pipeline: ['Data pipeline: ETL / ELT', 'Sources, ingest, bronze/silver/gold, orchestrator, serve.'], dataapp: ['Data app (Streamlit style)', 'Widgets rerun the script; cache and session state.'], scrape: ['A polite web scraper', 'Robots, fetch, parse, paginate, clean, validate.'],
  experiment: ['An A/B experiment', 'Hypothesis, power, randomise, run, analyse, decide.'], recsys: ['A recommender system', 'Candidates, ranking, re-ranking, logging, evaluation.'], content: ['A content system', 'Project to hook to pieces to schedule to measurement.'], freelance: ['A freelance project', 'Lead, call, scope, contract, milestones, invoice, referral.'],
});
