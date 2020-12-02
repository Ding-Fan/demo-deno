import { decode } from "https://deno.land/std@0.65.0/encoding/utf8.ts";
import { serve } from "https://deno.land/std@0.65.0/http/server.ts";
import { renderFile } from "https://raw.githubusercontent.com/syumai/dejs/master/mod.ts";
import { Client } from "https://deno.land/x/postgres@v0.4.5/mod.ts";

// const client = new Client({});

const server = serve({ port: 7777 });

const executeQuery = async (query, ...args) => {
  try {
    await client.connect();
    return await client.query(query, ...args);
  } catch (e) {
    console.log(e);
  } finally {
    await client.end();
  }
};

const getMessages = async () => {
  const result = await executeQuery("SELECT * FROM messages;");
  if (result) {
    return result.rowsOfObjects();
  }

  return [];
};

const addMessage = async (request) => {
  const body = decode(await Deno.readAll(request.body));
  const params = new URLSearchParams(body);

  const sender = params.get("sender");
  const message = params.get("message");

  await executeQuery(
    "INSERT INTO messages (sender, message) VALUES ($1, $2);",
    sender,
    message
  );
};

const deleteMessage = async (request) => {
  const parts = request.url.split("/");
  const id = parts[2];
  await executeQuery("DELETE FROM messages WHERE id = $1;", id);
};

const redirectToMessages = (request) => {
  request.respond({
    status: 303,
    headers: new Headers({
      Location: "/",
    }),
  });
};

const handleGetMessages = async (request) => {
  const data = {
    messages: await getMessages(),
  };
  request.respond({ body: await renderFile("index.ejs", data) });
};

const handlePostMessage = async (request) => {
  await addMessage(request);
  redirectToMessages(request);
};

const handleDeleteMessage = async (request) => {
  await deleteMessage(request);
  redirectToMessages(request);
};

for await (const request of server) {
  if (request.method === "GET" && request.url === "/") {
    await handleGetMessages(request);
  } else if (request.method === "POST" && request.url === "/") {
    await handlePostMessage(request);
  } else if (request.method === "POST" && request.url.includes("delete")) {
    await handleDeleteMessage(request);
  } else {
    redirectToMessages(request);
  }
}
