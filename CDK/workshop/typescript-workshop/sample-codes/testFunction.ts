// Hello, World! を表示する関数
function helloWorld(): void {
	// void は、何も値を返さないことを示しています。
	console.log("Hello, World!");
}

// 関数の呼び出し
helloWorld();

// `Hello World!`という文字列を返す関数
function getGreeting(): string {
	// 文字列型を戻す
	return "Hello, World!";
}

// hello_world() 関数の返り値を変数へ代入する
const greeting: string = getGreeting();
console.log(greeting); // Hello, World!

function saySomething(text: string) {
	console.log(text);
}

saySomething("Hello!");
saySomething("Good morning.");
saySomething("Hey There!");

function introduce(name: string, age: number) {
	console.log(`${name} is ${age} years old`);
}

introduce("Joe", 11);
introduce("Mary", 9);
