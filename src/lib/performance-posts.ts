export type PostStatus = "done" | "scheduled";

export type PostStats = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

export type PerformancePost = {
  id: string;
  title: string;
  status: PostStatus;
  thumbnail?: string;
  caption?: string;
  stats?: PostStats;
  scheduledTime?: string;
};

export const PREVIOUS_POSTS: PerformancePost[] = [
  { id: "7640388791521299726", status: "done", title: "if you are over 6 feet and you have been lifting for a while you have probably been told you are built for endurance not strength", thumbnail: "/thumbs/7640388791521299726.jpeg", caption: "#lifting #fitness #strengthtraining #talllifters #gymadvice", stats: { views: 878, likes: 26, comments: 2, shares: 1 } },
  { id: "7639791124252544286", status: "done", title: "most lifters treat deload weeks like a sign of weakness like if you take a lighter week you are going soft", thumbnail: "/thumbs/7639791124252544286.jpeg", caption: "#deload #recovery #gymlife #liftingadvice #strengthtraining", stats: { views: 903, likes: 22, comments: 2, shares: 3 } },
  { id: "7639655291029622029", status: "done", title: "becoming a dad does not mean your physique has to disappear but pretty much every piece of advice out there assumes you still have the same schedule you did at 24", thumbnail: "/thumbs/7639655291029622029.jpeg", caption: "#dadfitness #fitdad #gymlife #busydad #physique", stats: { views: 12500, likes: 102, comments: 2, shares: 0 } },
  { id: "7639253997185961247", status: "done", title: "the transition from college athlete to regular adult is where most guys lose the gym for good", thumbnail: "/thumbs/7639253997185961247.jpeg", caption: "#collegeathlete #adultfitness #gymlife #fitness #transition", stats: { views: 942, likes: 22, comments: 0, shares: 0 } },
  { id: "7638927125596097823", status: "done", title: "the guys who look like they live in the gym a lot of them are there four days a week", thumbnail: "/thumbs/7638927125596097823.jpeg", caption: "#gymefficiency #workoutsplit #fitnesstips #gymlife #4dayworkout", stats: { views: 816, likes: 25, comments: 0, shares: 0 } },
  { id: "7638506969095081247", status: "done", title: "most lifters treat cardio like it is the enemy of gains and if you are running 5 miles a day on top of heavy lifting that might be true", thumbnail: "/thumbs/7638506969095081247.jpeg", caption: "#cardio #gains #lifting #fitnesstips #musclebuilding", stats: { views: 430, likes: 10, comments: 0, shares: 0 } },
  { id: "7636527260677311758", status: "done", title: "the gym in college feels like the one thing you can control classes stress social stuff the gym is yours", thumbnail: "/thumbs/7636527260677311758.jpeg", caption: "#collegefitness #gymlife #studentathlete #mentalhealth #lifting", stats: { views: 1160, likes: 40, comments: 0, shares: 1 } },
  { id: "7636240073238859038", status: "done", title: "the fitness internet will have you believe that anything less than a perfect program perfectly executed is a waste of time", thumbnail: "/thumbs/7636240073238859038.jpeg", caption: "#fitnessmyths #gym #liftingadvice #fitness #programdesign", stats: { views: 46, likes: 0, comments: 0, shares: 0 } },
  { id: "7635855429465017631", status: "done", title: "most guys hit a wall and their first instinct is to add more volume more sets more days more exercises", thumbnail: "/thumbs/7635855429465017631.jpeg", caption: "#plateau #training #overtraining #gymadvice #volume", stats: { views: 513, likes: 23, comments: 0, shares: 0 } },
  { id: "7635505161065991455", status: "done", title: "Most guys with day jobs and partners and obligations think they need to overhaul their entire life to get back in shape", thumbnail: "/thumbs/7635505161065991455.jpeg", caption: "#busylifestyle #gymlife #fitness #worklifebalance #dadlife", stats: { views: 435, likes: 15, comments: 0, shares: 0 } },
  { id: "7635138094315932958", status: "done", title: "Some weeks the program holds. Some weeks Tuesday eats your squat session alive", thumbnail: "/thumbs/7635138094315932958.jpeg", caption: "#gymlife #consistency #liftinglife #squats #training", stats: { views: 355, likes: 7, comments: 0, shares: 0 } },
  { id: "7634628799740644622", status: "done", title: "Cutting is where most lifters watch a year of gains slip in eight weeks", thumbnail: "/thumbs/7634628799740644622.jpeg", caption: "#cutting #fatloss #musclemass #diet #bodyrecomp", stats: { views: 446, likes: 9, comments: 1, shares: 0 } },
  { id: "7634264872578059551", status: "done", title: "Ten years in the gym and the things I wish I had known on day one are not what you would expect", thumbnail: "/thumbs/7634264872578059551.jpeg", caption: "#gymwisdom #liftingadvice #10years #fitness #gymlife", stats: { views: 317, likes: 5, comments: 0, shares: 0 } },
  { id: "7633826380903370015", status: "done", title: "Shift work breaks the textbook training advice. You cannot eat at the same time every day sleep at the same time every night or train on a fixed schedule", thumbnail: "/thumbs/7633826380903370015.jpeg", caption: "#shiftwork #gymlife #fitness #nightshift #workerlife", stats: { views: 351, likes: 15, comments: 0, shares: 0 } },
];

export const POST_DATE_BY_ID: Record<string, string> = {
  "7640388791521299726": "2026-05-16",
  "7639791124252544286": "2026-05-14",
  "7639655291029622029": "2026-05-14",
  "7639253997185961247": "2026-05-13",
  "7638927125596097823": "2026-05-12",
  "7638506969095081247": "2026-05-11",
  "7636527260677311758": "2026-05-05",
  "7636240073238859038": "2026-05-05",
  "7635855429465017631": "2026-05-04",
  "7635505161065991455": "2026-05-03",
  "7635138094315932958": "2026-05-02",
  "7634628799740644622": "2026-04-30",
  "7634264872578059551": "2026-04-29",
  "7633826380903370015": "2026-04-28",
};

export const SCHEDULED_POSTS_BY_DATE: Record<string, PerformancePost[]> = {
  "2026-05-17": [
    { id: "s1", status: "scheduled", title: "The protein myth most lifters still believe in 2026", scheduledTime: "12:00 PM" },
    { id: "s2", status: "scheduled", title: "How to stay consistent when life gets completely in the way", scheduledTime: "7:00 PM" },
  ],
  "2026-05-19": [
    { id: "s3", status: "scheduled", title: "3 compound lifts you should never skip no matter how busy you are", scheduledTime: "12:00 PM" },
  ],
  "2026-05-20": [
    { id: "s4", status: "scheduled", title: "What I wish I knew before my first cut", scheduledTime: "6:30 PM" },
  ],
  "2026-05-21": [
    { id: "s5", status: "scheduled", title: "The mindset shift that actually changed how I train", scheduledTime: "5:00 PM" },
  ],
};
