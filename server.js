require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { S3Client, PutObjectCommand, ListObjectsCommand } = require("@aws-sdk/client-s3");

const app = express();
const port = 5000;

// Check if running on EKS or locally
app.use(cors({ origin: "*" }));

const s3Config =
  process.env.NODE_ENV !== "development"
    ? { region: process.env.AWS_REGION } // Use IAM Role on EKS
    : {
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      };

const s3 = new S3Client(s3Config);

const upload = multer({ storage: multer.memoryStorage() });

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `uploads/${Date.now()}_${file.originalname}`,
      Body: file.buffer,
      ContentType: file.mimetype
    };

    await s3.send(new PutObjectCommand(uploadParams));
    const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uploadParams.Key}`;

    res.json({ message: "File uploaded successfully", url: fileUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.get("/get-images", async (req, res) => {
  try {
    const listParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
    };

    const { Contents } = await s3.send(new ListObjectsCommand(listParams));

    if (!Contents) {
      return res.status(404).json({ error: "No images found" });
    }

    // Generate the public URLs of the images
    const imageUrls = Contents.map((item) => {
      return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${item.Key}`;
    });

    res.json({ images: imageUrls });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch images from S3" });
  }
});

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
