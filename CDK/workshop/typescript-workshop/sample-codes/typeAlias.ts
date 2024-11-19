type Staff = {
  firstName: string;
  lastName: string;
  jobTitle?: string;
};

const staff: Staff = {
  firstName: "田中",
  lastName: "太郎",
  jobTitle: "インフラエンジニア",
};
const boss: Staff = { firstName: "山田", lastName: "次郎" };

console.log(
  `${staff.firstName} ${staff.lastName} の役職は ${staff.jobTitle} で、上司は ${boss.firstName} ${boss.lastName} です。`,
);
