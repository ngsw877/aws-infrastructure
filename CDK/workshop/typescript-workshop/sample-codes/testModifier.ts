class Friend {
	//アクセス修飾子　private を追加
	private readonly firstName: string;
	private readonly lastName: string;

	constructor(firstName: string, lastName: string) {
		this.firstName = firstName;
		this.lastName = lastName;
	}
}
const goro = new Friend("Type", "四郎");

//エラーが出るため以下は削除（readonlyのため）
// goro.lastName = "五郎";

//エラーが出るため以下は削除（privateのため）
// console.log(`私の名前は ${goro.lastName} です。`);
