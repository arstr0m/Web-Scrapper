const axios = require('axios');
const cheerio = require('cheerio');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { createWriteStream } = require('fs');


const downloadImage = async (imageUrl, outputPath, retries = 3) => {
    try {
        const writer = createWriteStream(outputPath);
        const response = await axios({
            url: imageUrl,
            responseType: 'stream'
        });
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        if (retries > 0) {
            console.error(`Error downloading ${imageUrl}: ${error.message}. Retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return downloadImage(imageUrl, outputPath, retries - 1);
        } else {
            console.error(`Error downloading ${imageUrl}: ${error.message}`);
            throw error;
        }
    }
};


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const config = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive'
    }
};

rl.question('Url:  ', (url) => {
    const dir = './results';
    const imagesDir = path.join(dir, 'images');
    axios.get(url, config)
        .then(response => {
            const $ = cheerio.load(response.data);
            const pageTitle = $('head > title').text();
            console.log(`Title: ${pageTitle}`);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }
            if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir);
            }

            let make = [];
            $('a').each((index, element) => {
                const link = $(element).text();
                make.push(link);
                console.log(link);
            });
            let images = [];
            $('img').each(async (index, element) => {
                const imgSrc = $(element).attr('src');
                if (imgSrc) {
                    const imgUrl = new URL(imgSrc, url).href;
                    images.push(imgUrl);
                    console.log(imgUrl);
                    const imgName = path.basename(imgUrl);
                    const imgPath = path.join(imagesDir, imgName);
                    try {
                        await downloadImage( imgUrl, imgPath);
                        console.log(`Downloaded ${imgName}`);
                    } catch (error) {
                        console.error(`Error downloading ${imgName}: ${error.message}`);
                    }
                }
            });
            let description = []
            $('.formatted_sale_price').each((index, element) => {
                const desc = $(element).text();
                if (desc === '') return;
                description.push(desc);
                console.log(desc);
            });

            const filePath = path.join(dir, 'scraped_data.csv');
            let csvContent = `Type,Link,Image,Paragraph\n`;
            const maxLength = Math.max(make.length, images.length, description.length);
            for (let i = 0; i < maxLength; i++) {
                const link = make[i] ? make[i] : '';
                const imgSrc = images[i] ? images[i] : '';
                const paragraph = description[i] ? description[i].replace(/"/g, '""') : '';

                csvContent += `"${link}","${imgSrc}","${paragraph}"\n`;
            }

            fs.writeFileSync(filePath, csvContent);
            rl.close();
        })
        .catch(error => {
            console.error(`Error: ${error.message}`);
            rl.close();
        });
});
