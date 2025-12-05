# Client = Front-end
# Server = Back-end

# Connect you database:
  MONGO_URI = <mongodb_connection_string_here> 
  (Paste the connection link in server/.env)
  JWT_SECRET: <get the JWT from pc >
  (To get the JWT key run this on Powershell : "node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Install the dependencies

# How to run :
  Front-end: npm run dev
  Back-end: npm run server

