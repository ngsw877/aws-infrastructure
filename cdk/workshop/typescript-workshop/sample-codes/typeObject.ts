let person: { firstName: string; lastName?: string; age: number }; //オブジェクトの型を宣言
person = { firstName: "田中", lastName: "太郎", age: 30 }; //値を代入

console.log(person); //{ firstName: '田中', lastName: '太郎', age: 30 }
console.log(`私の名前は ${person.firstName} ${person.lastName} です。`);
console.log(`${person["age"]} 歳です。`);

delete person.lastName; //lastName を削除
console.log(person); // { firstName: 'AWS', age: 30 }
