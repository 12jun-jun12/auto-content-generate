import OpenAI from "openai";
import * as fs from "fs";
import axios from "axios";

const openai = new OpenAI({
  apiKey: "ここにAPIキー",
});
// ここにサイトURL及びWordpressのログイン情報を保持させます
const wp_url = "https://ドメイン/xmlrpc.php";
const user = "ここにユーザ名";
const password = "ここにパスワード";

// テキストファイルからキーワードを取得しmain処理を呼び出す
let filePath = "./keyword.txt";
fs.readFile(filePath, "utf8", async (err, data) => {
  if (err) {
    console.error("Error reading the file", err);
    return;
  }
  const keyword_list = data.split("\n");

  for (let keyword of keyword_list) {
    let question_title =
      "「" +
      keyword +
      "」のキーワードで上位表示するための記事のタイトルを作成してください。出力はタイトル1つのみで、文章ではなくタイトルだけでokです。";
    await main(question_title);
  }
});

//プロンプトを受け取り、chatGPTのAPI結果を返却する
async function generateContent(prompt) {
  let content = "";

  while (true) {
    let i = 1;
    let completion = await openai.chat.completions.create({
      // model: "gpt-3.5-turbo",
      // model:"gpt-4",
      model: "gpt-4-0613",
      messages: [
        {
          role: "system",
          content:
            "あなたはXXXXXのプロフェッショナルです。日本語で返答してください。",
        },
        // {
        //   role: "assistant",
        //   content:
        //     "必要に応じて何度も質問を繰り返し、内容の濃いコンテンツを作成します",
        // },
        { role: "user", content: prompt },
      ],
    });

    let message = completion.choices[0].message.content;
    content += message;
    // APIだと「続けてください」がうまく機能しないことが判明したため、下記をコメントアウトする
    // if (prompt.includes('」のキーワードで上位表示するための記事のタイトルを作成してください。出力はタイトル1つのみで、文章ではなくタイトルだけでokです。')) {
    //   break;
    // }else if (content.length <= 1500){
    //   prompt = "続きを教えてください。まとめは不要です。マークダウン形式で記述してください";
    // }else if(content.length > 1500 && prompt === "続きを教えてください。まとめは不要です。制約は続けてください。"){
    //   prompt = "続きを教えてください。まとめも作成してください。制約は続けてください。";
    // }else{
      break;
    // }
  }

  return content;
}

// WPに記事を投稿する関数
async function createPost(generated_title, generated_content) {
  const post = {
    post_type: "post",
    post_status: "draft",
    post_title: generated_title,
    post_content: generated_content,
  };

  const xml = `
      <?xml version="1.0"?>
      <methodCall>
          <methodName>wp.newPost</methodName>
          <params>
              <param><value><int>1</int></value></param>
              <param><value><string>${user}</string></value></param>
              <param><value><string>${password}</string></value></param>
              <param>
                  <value>
                      <struct>
                          ${Object.entries(post)
                            .map(
                              ([key, value]) =>
                                `<member>
                                  <name>${key}</name>
                                  <value><string>${value}</string></value>
                              </member>`
                            )
                            .join("")}
                      </struct>
                  </value>
              </param>
          </params>
      </methodCall>
  `;

  try {
    const response = await axios.post(wp_url, xml, {
      headers: {
        "Content-Type": "text/xml",
      },
    });

    // 応答から投稿IDを取得するロジックを追加する必要があるかもしれません。
    console.log("記事の投稿が完了しました:", response.data);
  } catch (error) {
    console.error("Error creating post:", error);
  }
}

//メイン処理。fs.readFileのアロー関数で呼ばれる。generateContentからコンテンツを受け取り、WP REST APIで記事投稿を行う。
async function main(question_title) {
  const generated_title = await generateContent(question_title);
  console.log("タイトル：" + generated_title);

  const question_content =
    "「" +
    generated_title +
    "」のキーワードで上位表示するための記事を作成してください。次の制約を必ず守ってください。◆制約：可能な限り長いコンテンツとすること/マークダウン形式で記述すること/すぐに本文から記述すること/見出しだけでなく本文を作成すること";
  const generated_content = await generateContent(question_content);
  console.log("記事作成完了");

  // 関数を呼び出して新規投稿を作成
  createPost(generated_title, generated_content);
}
