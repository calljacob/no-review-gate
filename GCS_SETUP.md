# Google Cloud Storage Setup

This application uses Google Cloud Storage (GCS) to store campaign logos. The bucket is configured as:
- **Bucket Name**: `feedback-calljacob`
- **Location Type**: Region
- **Location**: `us-west2`

## Required Environment Variables

Configure these environment variables in your Netlify dashboard:
**Site settings > Environment variables**

### Required Variables

1. **GCS_SERVICE_ACCOUNT_KEY** (Required)
   - The JSON key file content from your Google Cloud Service Account
   - This should be the entire JSON object as a string
   - Example format:
     ```json
     {"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
     ```
   - **Note**: In Netlify, paste the entire JSON on a single line (minified) or use the multiline environment variable support

2. **GCS_PROJECT_ID** (Recommended)
   - Your Google Cloud Project ID
   - Example: `your-gcp-project-id`
   - This helps ensure proper project context

### Alternative: Using File Path

If you prefer using a file path instead (useful for local development):
- **GOOGLE_APPLICATION_CREDENTIALS**: Path to your service account JSON key file
  - Example: `/path/to/service-account-key.json`
  - **Note**: This approach requires file system access, which may not work in all serverless environments

## Setting Up Google Cloud Storage

### 1. Create a Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **IAM & Admin > Service Accounts**
3. Click **Create Service Account**
4. Enter a name (e.g., `netlify-logo-uploader`)
5. Click **Create and Continue**
6. Grant the following roles:
   - **Storage Object Admin** (to upload and manage objects)
   - Or create a custom role with these permissions:
     - `storage.objects.create`
     - `storage.objects.delete`
     - `storage.objects.get`
     - `storage.objects.list`
     - `storage.buckets.get`

### 2. Create and Download the Key

1. Click on the created service account
2. Go to the **Keys** tab
3. Click **Add Key > Create new key**
4. Choose **JSON** format
5. Download the key file
6. Copy the entire JSON content and paste it into the `GCS_SERVICE_ACCOUNT_KEY` environment variable in Netlify

### 3. Configure Bucket Permissions

1. Go to **Cloud Storage > Buckets** in Google Cloud Console
2. Select the `feedback-calljacob` bucket
3. Go to **Permissions** tab
4. Ensure your service account has the necessary permissions (should be covered by the service account roles)
5. For public access (to serve images directly):
   - Go to the bucket's **Permissions** tab
   - Files uploaded via the API will be made public automatically by the `upload-logo.js` function
   - Alternatively, you can set a bucket-level policy to make all objects public (not recommended for security)

### 4. Verify Bucket Configuration

The bucket should be:
- **Name**: `feedback-calljacob`
- **Location type**: Region
- **Location**: `us-west2`

If you need to create the bucket:
```bash
gsutil mb -l us-west2 gs://feedback-calljacob
```

## How It Works

1. **Upload**: When a logo is uploaded via `/api/upload-logo`, the file is:
   - Validated (type, size)
   - Converted from base64 to a buffer
   - Uploaded to GCS at `gs://feedback-calljacob/campaign-logos/<filename>`
   - Made publicly accessible
   - Returns the object name (stored in database as `logo_url`)

2. **Serve**: When a logo is requested via `/api/serve-logo?key=<object-name>`, the function:
   - Retrieves the file from GCS
   - Returns it with appropriate headers (content-type, caching)

3. **Alternative**: Since files are public, you can also access them directly:
   ```
   https://storage.googleapis.com/feedback-calljacob/campaign-logos/<object-name>
   ```

## Local Development

For local development, create a `.env` file in the root directory:

```env
GCS_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
GCS_PROJECT_ID=your-project-id
```

Or use the file path approach:
```env
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
GCS_PROJECT_ID=your-project-id
```

Then run:
```bash
netlify dev
```

## Troubleshooting

### 500 Error: "Failed to upload logo"

This is the most common error. Check the following:

#### 1. Check Environment Variables in Netlify
- Go to **Site settings > Environment variables** in Netlify
- Verify `GCS_SERVICE_ACCOUNT_KEY` is set
- Verify `GCS_PROJECT_ID` is set (recommended)
- **Important**: After adding/updating environment variables, you may need to redeploy your site

#### 2. Verify GCS_SERVICE_ACCOUNT_KEY Format
- The value must be valid JSON
- In Netlify, paste it as a single-line string (minified)
- Example of correct format:
  ```json
  {"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
  ```
- **Common mistake**: Including newlines or extra spaces. The JSON should be on one line.

#### 3. Check Netlify Function Logs
- Go to **Functions** tab in Netlify dashboard
- Click on the `upload-logo` function
- Check the logs for detailed error messages
- Look for messages like:
  - "GCS credentials not found" → Missing environment variable
  - "Invalid GCS_SERVICE_ACCOUNT_KEY format" → JSON parsing error
  - "Bucket not found" → Bucket doesn't exist or wrong name
  - "Permission denied" → Service account lacks permissions

#### 4. Verify Bucket Exists
- Go to [Google Cloud Console](https://console.cloud.google.com/storage/browser)
- Verify the bucket `feedback-calljacob` exists
- Check it's in the correct region: `us-west2`
- If it doesn't exist, create it:
  ```bash
  gsutil mb -l us-west2 gs://feedback-calljacob
  ```

#### 5. Verify Service Account Permissions
- Go to **IAM & Admin > Service Accounts** in Google Cloud Console
- Find your service account (the email from the JSON key)
- Verify it has the **Storage Object Admin** role
- Or ensure it has these permissions:
  - `storage.objects.create`
  - `storage.objects.get`
  - `storage.objects.setIamPolicy` (for making files public)
  - `storage.buckets.get`

#### 6. Test Credentials Locally
Create a test file to verify credentials work:
```javascript
// test-gcs.js
import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';

dotenv.config();

const storage = new Storage({
  credentials: JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY),
  projectId: process.env.GCS_PROJECT_ID,
});

const bucket = storage.bucket('feedback-calljacob');

bucket.exists()
  .then(([exists]) => {
    console.log('Bucket exists:', exists);
    if (exists) {
      console.log('✅ Credentials are working!');
    } else {
      console.log('❌ Bucket not found');
    }
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
  });
```

### Error: "Invalid GCS_SERVICE_ACCOUNT_KEY format"
- Ensure the JSON is valid and properly escaped in Netlify
- Try minifying the JSON before pasting (remove all newlines)
- Check that all quotes are properly escaped
- Verify the private key includes `\n` characters (they should be literal `\n`, not actual newlines)

### Error: "Permission denied" or "Access denied"
- Verify the service account has the correct IAM roles
- Check that the service account email has access to the bucket
- Ensure the bucket name is correct: `feedback-calljacob`
- Grant the service account **Storage Object Admin** role at the project or bucket level

### Error: "Bucket not found"
- Verify the bucket exists in your Google Cloud project
- Check the bucket name matches exactly: `feedback-calljacob` (case-sensitive)
- Ensure you're using the correct GCP project
- Verify the service account has access to the project where the bucket exists

### Files not accessible publicly
- The upload function automatically makes files public with `file.makePublic()`
- If this fails, check that the service account has `storage.objects.setIamPolicy` permission
- Alternatively, configure the bucket to allow public access (less secure)
- You can test by accessing: `https://storage.googleapis.com/feedback-calljacob/campaign-logos/<filename>`

## Security Notes

- Keep your service account key secure and never commit it to version control
- Use environment variables in Netlify for production
- The service account should have minimal required permissions
- Consider using bucket-level IAM policies for additional security
- Review and rotate service account keys periodically

