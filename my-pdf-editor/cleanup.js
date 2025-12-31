const fs = require('fs');
const path = require('path');

function cleanupUploads() {
    const uploadDir = path.join(__dirname, 'uploads');
    
    if (!fs.existsSync(uploadDir)) {
        console.log('Upload directory does not exist');
        return;
    }
    
    const files = fs.readdirSync(uploadDir);
    
    files.forEach(file => {
        const filePath = path.join(uploadDir, file);
        const stat = fs.statSync(filePath);
        const now = new Date();
        const fileTime = new Date(stat.mtime);
        
        // Calculate age in hours
        const ageInHours = (now - fileTime) / (1000 * 60 * 60);
        
        // Delete files older than 24 hours
        if (ageInHours > 24) {
            fs.unlinkSync(filePath);
            console.log(`Deleted old file: ${file}`);
        }
    });
    
    console.log(`Cleanup completed at ${new Date().toISOString()}`);
}

// Run cleanup immediately when this script is executed
if (require.main === module) {
    cleanupUploads();
}

module.exports = { cleanupUploads };