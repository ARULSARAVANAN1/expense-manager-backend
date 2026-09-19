import "dotenv/config";
import app from "./app";
import { connectDatabase } from "./config/database.js";

const PORT = Number(process.env.PORT) || 3000;

// Function to start the server and connect to the database
async function startServer() {
    try {
        await connectDatabase();
        
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to connect to the database", error);
        process.exit(1)
    }
}

startServer();