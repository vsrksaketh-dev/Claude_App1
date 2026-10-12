// Static content for the MBA Knowledge Engine. Items rotate by day / week.

export const GUESSTIMATES = [
  {
    q: 'Estimate the number of two-wheelers rented by tourists in North Goa on a peak December day.',
    hint: 'Tourists present per day, share in North Goa, share who ride, share who rent, riders per bike.',
    steps: [
      ['Tourists present in Goa on a peak day', '~15 lakh December arrivals ÷ 30 days = 50k arrivals/day × ~4-day stay ≈ 2 lakh'],
      ['Share staying in North Goa', '65% × 2 lakh ≈ 1.3 lakh'],
      ['Share who ride (adults, 18-45, comfortable on a bike)', '60% × 1.3 lakh ≈ 78,000'],
      ['Share who rent rather than bring or take taxis', '40% × 78,000 ≈ 31,000 riders'],
      ['Riders per bike (couples and friends share)', '31,000 ÷ 1.3 ≈ 24,000'],
    ],
    answer: '≈ 24,000 two-wheelers. Sanity check: Goa\'s rental fleet is commonly put in the tens of thousands, so 20-25k in North Goa is plausible.',
  },
  {
    q: 'Estimate the number of cups of coffee consumed in Goa daily.',
    hint: 'Residents plus tourists present, share who drink coffee, cups per drinker.',
    steps: [
      ['Residents', '~15 lakh'],
      ['Tourists present on an average day', '~1 lakh (lower than peak)'],
      ['Share who drink coffee on a given day', '25% × 16 lakh = 4 lakh'],
      ['Cups per drinker per day', '1.5 (tourists and cafe regulars higher, home drinkers lower)'],
    ],
    answer: '≈ 6 lakh cups a day. Segment further: cafes and cafe-style outlets ≈ 30%, homes ≈ 50%, offices and others ≈ 20%.',
  },
  {
    q: 'Estimate the number of pizzas sold per day in Delhi NCR.',
    hint: 'Households, share ordering monthly, orders per month, pizzas per order, add walk-in and dine-in.',
    steps: [
      ['Population ~3 crore ÷ 5 per household', '≈ 60 lakh households'],
      ['Households ordering pizza in a month', '25% = 15 lakh'],
      ['Orders per ordering household per month', '2 → 30 lakh orders/month ≈ 1 lakh/day'],
      ['Add dine-in and walk-in (~30% on top)', '≈ 1.3 lakh orders/day'],
      ['Pizzas per order', '1.5'],
    ],
    answer: '≈ 2 lakh pizzas a day.',
  },
  {
    q: 'Estimate the annual sunscreen market in India, in rupees.',
    hint: 'Start from urban adults, then regular users, bottles a year and price.',
    steps: [
      ['Urban population', '~50 crore'],
      ['Aged 15-45', '45% ≈ 22 crore'],
      ['Regular sunscreen users', '5% ≈ 1.1 crore'],
      ['Units per user per year', '2 → 2.2 crore units'],
      ['Average price per unit', '₹400'],
    ],
    answer: '≈ ₹900 crore. Upside lever: penetration. Moving 5% to 10% doubles the market.',
  },
  {
    q: 'Estimate the number of cab and auto app rides in Bengaluru per day.',
    hint: 'Population, adult share, weekly app users, rides per week.',
    steps: [
      ['Population', '~1.3 crore; adults ≈ 90 lakh'],
      ['Use a ride app at least weekly', '15% ≈ 13.5 lakh'],
      ['Rides per user per week', '4 → 54 lakh/week'],
      ['Per day', '54 lakh ÷ 7 ≈ 7.7 lakh'],
    ],
    answer: '≈ 8 lakh rides a day. Cross-check by supply: ~2 lakh vehicles × ~4 trips each ≈ 8 lakh.',
  },
  {
    q: 'Estimate the number of smartphones sold in India per day.',
    hint: 'Users divided by replacement cycle is a clean top-down route.',
    steps: [
      ['Smartphone users', '~65 crore'],
      ['Average replacement cycle', '4.5 years'],
      ['Annual unit demand', '65 crore ÷ 4.5 ≈ 14.4 crore'],
      ['Per day', '14.4 crore ÷ 365 ≈ 3.9 lakh'],
    ],
    answer: '≈ 4 lakh phones a day. Growth in users adds a little, shorter premium cycles add a little.',
  },
  {
    q: 'Estimate the number of cups of chai sold at roadside stalls in Mumbai daily.',
    hint: 'Metro population, tea drinkers, share buying outside, cups per day.',
    steps: [
      ['MMR population', '~2 crore'],
      ['Tea drinkers', '70% = 1.4 crore'],
      ['Buy at least some tea outside the home', '40% = 56 lakh'],
      ['Cups bought outside per day', '1.5'],
    ],
    answer: '≈ 85 lakh cups a day. Stall check: ~50,000 stalls × 170 cups ≈ 85 lakh.',
  },
];

export const FRAMEWORKS = [
  { name: '4Ps of Marketing', area: 'Marketing', summary: 'The controllable levers of a marketing mix.',
    parts: [['Product', 'What you sell and the value it carries'], ['Price', 'What it costs and how the price signals value'], ['Place', 'Where and how customers can get it'], ['Promotion', 'How you communicate and persuade']],
    use: 'Launching or auditing any offering.', example: 'Amul sells mass-affordable dairy (product, price) through vast rural and urban distribution (place) with witty topical ads (promotion).' },
  { name: 'STP', area: 'Marketing', summary: 'Choose who you serve before deciding how to serve them.',
    parts: [['Segmentation', 'Split the market by demographics, behaviour, needs'], ['Targeting', 'Pick the segments worth winning'], ['Positioning', 'Own a distinct place in the target\'s mind']],
    use: 'Before any campaign or product decision.', example: 'Royal Enfield targets riders seeking identity and heritage, not the cheapest commute.' },
  { name: 'Porter\'s Five Forces', area: 'Strategy', summary: 'Why some industries are more profitable than others.',
    parts: [['Rivalry', 'Intensity of competition'], ['New entrants', 'Barriers to entry'], ['Substitutes', 'Other ways to meet the same need'], ['Buyer power', 'Customers\' ability to push prices down'], ['Supplier power', 'Suppliers\' ability to push costs up']],
    use: 'Judging industry attractiveness.', example: 'Indian telecom: high rivalry, heavy capital barriers, strong buyer power.' },
  { name: 'AIDA', area: 'Marketing', summary: 'The attention-to-action funnel for any message.',
    parts: [['Attention', 'Stop the scroll'], ['Interest', 'Make it relevant'], ['Desire', 'Make them want it'], ['Action', 'Make the next step obvious']],
    use: 'Writing ads, landing pages and cold outreach.', example: 'A LinkedIn note to a recruiter: hook (A), relevance to their hiring (I), proof (D), clear ask (A).' },
  { name: 'Dave Ulrich HR Model', area: 'HR', summary: 'Moves HR from administration to strategic partner.',
    parts: [['Strategic Partner', 'Align HR with business goals'], ['Change Agent', 'Lead transformation and culture shifts'], ['Employee Champion', 'Handle talent, morale and daily concerns'], ['Administrative Expert', 'Run payroll, process and compliance efficiently']],
    use: 'Explaining what modern HR should do and how to structure the function.', example: 'Shared services handle admin; HR business partners handle strategy.' },
  { name: '9-Box Grid', area: 'HR', summary: 'Plots performance against potential for talent decisions.',
    parts: [['X axis', 'Performance: low, moderate, high'], ['Y axis', 'Potential: low, moderate, high'], ['Top-right', 'Stars: promote and retain'], ['Bottom-left', 'Underperformers: coach or exit']],
    use: 'Succession planning and calibration.', example: 'High performer with low potential: reward and keep, but do not fast-track to leadership.' },
  { name: 'Job Characteristics Model', area: 'HR', summary: 'Designs motivating jobs (Hackman and Oldham).',
    parts: [['Core dimensions', 'Skill variety, task identity, task significance, autonomy, feedback'], ['Psychological states', 'Meaningfulness, responsibility, knowledge of results'], ['Outcomes', 'Motivation, satisfaction, performance, lower turnover']],
    use: 'Job redesign and enrichment.', example: 'Giving a support agent ownership of a case end to end raises identity and significance.' },
  { name: 'Tuckman\'s Stages', area: 'HR', summary: 'How teams develop over time.',
    parts: [['Forming', 'Polite, unclear roles'], ['Storming', 'Conflict over approach and power'], ['Norming', 'Shared rules emerge'], ['Performing', 'High trust and output'], ['Adjourning', 'Wrap-up and transition']],
    use: 'Managing group projects and new teams.', example: 'Your term project team will almost certainly storm in week two. That is normal.' },
  { name: 'PESTLE', area: 'Strategy', summary: 'Scan the macro environment around a business.',
    parts: [['Political', 'Policy, stability, trade'], ['Economic', 'Growth, inflation, rates, currency'], ['Social', 'Demographics, culture, values'], ['Technological', 'Innovation and disruption'], ['Legal', 'Regulation and compliance'], ['Environmental', 'Climate and sustainability']],
    use: 'Market entry and strategic planning.', example: 'India\'s consolidated labour codes sit under Legal and change HR cost structures.' },
  { name: 'VRIO', area: 'Strategy', summary: 'Tests whether a resource gives lasting advantage.',
    parts: [['Valuable', 'Does it help exploit opportunities or neutralise threats?'], ['Rare', 'Do few competitors have it?'], ['Inimitable', 'Is it costly to copy?'], ['Organised', 'Is the firm set up to capture its value?']],
    use: 'Finding genuine sources of competitive advantage.', example: 'Tata\'s trust-heavy brand: valuable, rare, hard to copy, and organised around the group.' },
  { name: 'BCG Matrix', area: 'Strategy', summary: 'Allocates capital across a product portfolio.',
    parts: [['Stars', 'High growth, high share: invest'], ['Cash cows', 'Low growth, high share: milk'], ['Question marks', 'High growth, low share: pick winners'], ['Dogs', 'Low growth, low share: divest or fix']],
    use: 'Portfolio and investment decisions.', example: 'A FMCG firm funds a new category (question mark) from a mature staple (cash cow).' },
  { name: 'Ansoff Matrix', area: 'Strategy', summary: 'Four growth routes by product and market newness.',
    parts: [['Market penetration', 'Existing product, existing market'], ['Market development', 'Existing product, new market'], ['Product development', 'New product, existing market'], ['Diversification', 'New product, new market (highest risk)']],
    use: 'Choosing a growth strategy.', example: 'A Goa cafe adding a second outlet in Pune is market development.' },
];

export const JARGON = [
  { term: 'Employee Net Promoter Score (eNPS)', meaning: 'Employee loyalty metric from one question: how likely are you to recommend this company as a place to work, 0 to 10? Score = % Promoters (9-10) minus % Detractors (0-6).' },
  { term: 'EBITDA', meaning: 'Earnings before interest, tax, depreciation and amortisation. A rough view of operating profit before financing and accounting choices.' },
  { term: 'CAC', meaning: 'Customer Acquisition Cost: total sales and marketing spend divided by new customers won in the period.' },
  { term: 'LTV', meaning: 'Lifetime Value: total profit expected from a customer over the relationship. Healthy businesses aim for LTV well above CAC (3x is a common rule of thumb).' },
  { term: 'Moat', meaning: 'A durable advantage (brand, scale, switching costs, network effects) that protects profits from competitors.' },
  { term: 'Working capital', meaning: 'Current assets minus current liabilities: the cash a firm needs to run day to day.' },
  { term: 'Burn rate', meaning: 'How fast a company spends cash, usually per month. Cash divided by burn rate gives runway.' },
  { term: 'Basis point', meaning: 'One hundredth of a percentage point. A 25 bps rate cut means 0.25 percentage points.' },
  { term: 'Attrition rate', meaning: 'Share of employees who leave in a period. Voluntary attrition is the part employees choose.' },
  { term: 'Unit economics', meaning: 'Profit or loss on one unit (one order, customer or store), before overheads. If it is negative, scale makes losses bigger.' },
];

export const TEARDOWNS = [
  { name: 'Dove: Campaign for Real Beauty', verdict: 'Success', year: '2004 onward', brand: 'Dove (Unilever)',
    audience: 'Women tired of narrow beauty ideals in advertising.',
    positioning: 'Beauty brand that celebrates real women instead of selling an aspiration.',
    tactics: 'Real women in place of models, films like Evolution and Real Beauty Sketches, long-running consistent theme.',
    result: 'Widely cited as lifting Dove from a soap brand into a multi-billion global brand. Treat exact ROI figures as company-reported.',
    lesson: 'A values-led positioning is easier to sustain for years than a product-feature claim, but only if the product and behaviour back it.' },
  { name: 'Pepsi: "Live for Now" with Kendall Jenner', verdict: 'Failure', year: '2017', brand: 'Pepsi',
    audience: 'Young, socially aware consumers.',
    positioning: 'Pepsi as a symbol of unity and protest-era youth culture.',
    tactics: 'Celebrity in a staged protest scene resolved by handing a cop a can of Pepsi.',
    result: 'Heavy backlash for trivialising social movements; withdrawn within about a day with an apology.',
    lesson: 'Borrowing the emotion of a social cause without credibility reads as exploitation. Test creative with the communities it depicts.' },
  { name: 'Amul: the Utterly Butterly topical ads', verdict: 'Success', year: '1966 onward', brand: 'Amul',
    audience: 'Mass-market Indian households and anyone who reads a newspaper.',
    positioning: 'Affordable, trusted, and part of daily Indian life; cheeky commentary on the news.',
    tactics: 'Hoardings reacting to current events, one consistent mascot and line, tiny budgets relative to reach.',
    result: 'One of the longest-running ad campaigns in the world, with brand recall far above its spend.',
    lesson: 'Consistency plus relevance compounds. A recognisable format lets you run cheap, fast creative for decades.' },
  { name: 'Nike: "Dream Crazy" with Colin Kaepernick', verdict: 'Success (polarising)', year: '2018', brand: 'Nike',
    audience: 'Younger, urban, values-driven consumers who are Nike\'s core growth segment.',
    positioning: 'Sport as courage and conviction, not just performance.',
    tactics: 'Controversial athlete as the face, narrated film, anniversary of "Just Do It".',
    result: 'Boycott calls and burned shoes online, yet reports of strong online sales and brand heat among its core buyers. Short-term numbers were reported widely; verify before quoting.',
    lesson: 'Brands can win by choosing a side if the target segment is clear, the stance fits the brand, and leadership accepts losing some customers.' },
];

export const HR_TRENDS = [
  { title: 'Return to office vs flexibility', body: 'In-office roles now dominate new tech openings in India. Expect tension between control and autonomy, and watch engagement, attrition and hiring pool effects.', lens: 'OB lens: Theory X vs Theory Y, autonomy in the Job Characteristics Model.' },
  { title: 'India\'s consolidated labour codes', body: 'Twenty-nine older central laws were consolidated into four codes covering wages, industrial relations, social security and occupational safety. HR teams are reworking payroll structures, contracts and compliance processes.', lens: 'HR lens: Ulrich\'s Administrative Expert role grows in importance.' },
  { title: 'Skills-based hiring', body: 'Employers are screening on demonstrated skills and projects rather than pedigree alone, helped by assessments and work samples.', lens: 'Placement lens: build proof-of-work, not just a CV.' },
  { title: 'AI in HR and people analytics', body: 'Screening, scheduling and attrition prediction are being automated. Bias, transparency and consent are the live debates.', lens: 'Case angle: when should a human override an algorithmic shortlist?' },
  { title: 'Quiet quitting and engagement', body: 'Disengagement shows up as doing only the minimum. Gallup-style engagement surveys and eNPS track it, but root causes are usually manager quality and workload.', lens: 'OB lens: Herzberg hygiene vs motivators.' },
  { title: 'Case study: Zappos and Holacracy', body: 'Zappos adopted self-management in 2013-14. A wave of departures followed, a reminder that radical structure changes carry culture and retention costs.', lens: 'Discussion: what preconditions does self-management need?' },
];

export const STAR_TRAITS = ['Leadership', 'Conflict', 'Innovation', 'Teamwork', 'Failure', 'Initiative'];
export const KANBAN_COLUMNS = ['To apply', 'Applied', 'Assessment', 'Interview', 'Offer'];
export const APPLY_STEPS = [['superset', 'Superset'], ['portal', 'Company portal'], ['form', 'Google Form'], ['cv', 'CV named and uploaded']];
export const DEFAULT_ROUTINE = ['Skin care', 'Take medication', 'Read 10 pages'];
export const EXPENSE_CATS = ['Food', 'Travel', 'Rent', 'Fun', 'Study', 'Other'];

export const MENTAL_MODELS = [
  { name: 'First principles', summary: 'Break a problem into its basic truths, then rebuild from there instead of copying how it is usually done.', use: 'When "that is how it works" is the only reason given.', example: 'Ask what a product is made of and what those parts cost, before accepting its price.' },
  { name: 'Inversion', summary: 'Ask how you would guarantee failure, then avoid those things.', use: 'Hiring, planning, relationships, any goal that feels vague.', example: 'To build a strong team, list how teams fall apart: unclear roles, silent conflict, no feedback. Then design against them.' },
  { name: 'Second-order thinking', summary: 'Consider the consequences of the consequences, not just the first effect.', use: 'Policy, pricing, incentive design.', example: 'A steep discount lifts sales now (first order) and trains customers to wait for sales (second order).' },
  { name: 'Circle of competence', summary: 'Know the edge of what you truly understand and be honest about it.', use: 'Before giving strong opinions or making bets.', example: 'Say "I do not know enough here" and either learn or defer to someone who does.' },
  { name: 'Pareto principle (80/20)', summary: 'A small share of inputs usually drives most of the results.', use: 'Prioritising study topics, customers, tasks.', example: 'A few frameworks come up in most cases. Master those first.' },
  { name: 'Opportunity cost', summary: 'The real price of a choice is the best alternative you gave up.', use: 'Time, money and attention decisions.', example: 'Three hours scrolling costs the chapter you did not read.' },
  { name: 'Hanlon\'s razor', summary: 'Do not attribute to malice what is adequately explained by neglect or error.', use: 'Workplace conflict and group projects.', example: 'The teammate who missed the deadline probably misread it before they dodged it.' },
  { name: 'The map is not the territory', summary: 'Models and reports simplify reality and can mislead when taken literally.', use: 'Reading dashboards, rankings, org charts.', example: 'An engagement score is a map. Go and talk to the people.' },
  { name: 'Bayesian updating', summary: 'Start with a belief, then shift it in proportion to how strong the new evidence is.', use: 'News, forecasting, interviews.', example: 'One glowing reference moves you a little. Five consistent ones move you a lot.' },
  { name: 'Chesterton\'s fence', summary: 'Do not remove a rule or practice until you know why it was put there.', use: 'Change management, new-job habits.', example: 'Before scrapping a slow approval step, find out what failure it once prevented.' },
  { name: 'Goodhart\'s law', summary: 'When a measure becomes a target, it stops being a good measure.', use: 'KPIs, grades, habit tracking.', example: 'Call-centre agents hit the "short call" target by hanging up on hard customers.' },
  { name: 'Lindy effect', summary: 'The longer something non-perishable has survived, the longer it is likely to last.', use: 'Choosing books, ideas, skills to invest in.', example: 'A 100-year-old management idea likely outlives this year\'s fad.' },
  { name: 'Sunk cost fallacy', summary: 'Past, unrecoverable spending should not decide future choices.', use: 'Quitting projects, courses, bad investments.', example: 'Finishing a bad book because you are already 200 pages in.' },
  { name: 'Confirmation bias', summary: 'We favour evidence that supports what we already believe.', use: 'Research, hiring, arguments.', example: 'Before deciding, search for the best case against your view.' },
];

export const REFLECTION_PROMPTS = [
  'Where were you fully present today?',
  'What did you avoid today, and why?',
  'What would make tomorrow a clear win?',
  'Who did you learn from or help?',
  'What did you learn that you could teach someone?',
  'Where did your time not match your priorities?',
  'What gave you energy today, and what drained it?',
  'Which decision are you putting off?',
  'What did you do better than last week?',
  'What are you grateful for right now?',
];

export const GOAL_AREAS = ['Career', 'Learning', 'Health', 'Money', 'Relationships', 'Projects'];
export const LIB_KINDS = ['Book', 'Article', 'Course', 'Podcast', 'Paper'];
export const DAILY_FIVE = [['guess', 'Guesstimate'], ['framework', 'Framework'], ['jargon', 'Jargon'], ['model', 'Mental model'], ['news', 'News']];
export const DEFAULT_HABITS = [['Skin care', 'morning'], ['Take medication', 'morning'], ['Read 10 pages', 'anytime']];
