const AWS = require('aws-sdk');
require('dotenv').config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const uploadPDFToS3 = async (buffer, fileName) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `quotations/${fileName}`,
    Body: buffer,
    ContentType: 'application/pdf',
    ACL: 'public-read'
  };

  const data = await s3.upload(params).promise();
  return data.Location;
};

module.exports = { uploadPDFToS3 };