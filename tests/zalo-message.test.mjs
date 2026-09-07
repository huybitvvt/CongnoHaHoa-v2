import assert from "node:assert/strict";
import test from "node:test";
import { collectZaloImages, encodeZaloMessageBody, parseZaloMessageBody } from "../lib/zalo-message.ts";

const imageA = `data:image/jpeg;base64,${Buffer.from("image-a").toString("base64")}`;
const imageB = `data:image/png;base64,${Buffer.from("image-b").toString("base64")}`;

test("lưu và đọc lại nội dung cùng ảnh Zalo", () => {
  const encoded = encodeZaloMessageBody("Ảnh sản phẩm", [{ dataUrl: imageA }]);
  const parsed = parseZaloMessageBody(encoded);

  assert.equal(parsed.text, "Ảnh sản phẩm");
  assert.deepEqual(parsed.imageDataUrls, [imageA]);
});

test("tin chỉ có ảnh hiển thị nhãn Ảnh", () => {
  const parsed = parseZaloMessageBody(encodeZaloMessageBody("[Ảnh]", [{ dataUrl: imageA }]));

  assert.equal(parsed.text, "[Ảnh]");
  assert.deepEqual(parsed.imageDataUrls, [imageA]);
});

test("chỉ đưa tối đa các ảnh mới nhất vào ngữ cảnh AI", () => {
  const messages = [
    { body: encodeZaloMessageBody("Cũ", [{ dataUrl: imageA }]) },
    { body: encodeZaloMessageBody("Mới", [{ dataUrl: imageB }]) },
  ];

  assert.deepEqual(collectZaloImages(messages, 1), [imageB]);
});
