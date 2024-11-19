class Person {
  firstName: string;
  lastName: string;
  // コンストラクタのパラメーターにデフォルト値を設定しました。
  constructor(firstName = "田中", lastName = "太郎") {
    this.firstName = firstName;
    this.lastName = lastName;
  }
  greet() {
    console.log(`私は ${this.firstName} ${this.lastName} です。`);
  }
}

// Person に渡していた引数を削除しました。何も指定しなければ、デフォルトのプロパティが設定されます。
const taro = new Person();
//従来通り引数を渡すことも可能です。
const jiro = new Person("山田", "次郎");

taro.greet();
jiro.greet();

// Person クラスを継承した Teacher クラスを定義。
class Teacher extends Person {
  // 独自のプロパティとして、Subject を追加します。
  subject: string;
  constructor(subject: string, firstName = "高橋", lastName = "三郎") {
    // 継承先のコンストラクタでは、プロパティ( this.xxx )にアクセスする前に super() を呼ぶ必要があります。
    super(firstName, lastName); //親クラスのコンストラクタを呼び出し
    this.subject = subject;
  }
  // greet メソッドを Teacher 独自のものに書き換えます。
  greet() {
    console.log(
      `私は ${this.firstName} ${this.lastName} です。${this.subject} の先生をやっています。`,
    );
  }
}

// subject を Teacher クラスに渡し、オブジェクトを初期化します。
const saburo = new Teacher("国語");
saburo.greet();
