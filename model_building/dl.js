import fs from 'fs';
import { parse } from 'csv-parse';
import * as tf from '@tensorflow/tfjs';

const loadCSV = (filePath) => {
    return new Promise((resolve, reject) => {
        const data = [];
        fs.createReadStream(filePath)
            .pipe(parse({ delimiter: ',' }))
            .on('data', (row) => {
                data.push(row.map(Number)); // Convert all values to numbers
            })
            .on('end', () => {
                resolve(data);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
};

const loadMNISTData = async (trainFilePath, testFilePath) => {
    try {
        const trainData = await loadCSV(trainFilePath);
        const testData = await loadCSV(testFilePath);

        return { train_data: trainData, test_data: testData };
    } catch (error) {
        console.error('Error loading MNIST data:', error);
        return { train_data: [], test_data: [] };
    }
};

const normalizeData = (data) => {
    return data.map(row => row.map(value => value / 255));
};

const createModel = () => {
    const model = tf.sequential();

    model.add(tf.layers.dense({
        inputShape: [784],
        units: 128,
        activation: 'relu'
    }));
    model.add(tf.layers.dense({
        units: 64,
        activation: 'relu'
    }));
    model.add(tf.layers.dense({
        units: 10,
        activation: 'softmax'
    }));

    model.compile({
        optimizer: tf.train.adam(0.001), // Adjust learning rate if needed
        loss: 'sparseCategoricalCrossentropy',
        metrics: ['accuracy']
    });

    return model;
};

const splitData = (data) => {
    const x = [];
    const y = [];
    data.forEach(row => {
        y.push(row[0]); // First column is the label
        x.push(row.slice(1)); // Remaining columns are the features
    });
    return { x, y };
};

const augmentImage = (row, rotationRange = 45, scaleRange = 0.2, noiseStdDev = 0.1) => {
    let tensor = tf.tensor2d(row, [28, 28]);

    // Normalize the pixel values to [0, 1]
    tensor = tensor.div(255);

    // Expand dimensions to make it 4D
    tensor = tensor.expandDims(0).expandDims(-1);

    // Randomly rotate the image
    const rotationAngle = (Math.random() * 2 - 1) * rotationRange * (Math.PI / 180);
    tensor = tf.image.rotateWithOffset(tensor, rotationAngle, 0.5, 0.5);

    // Randomly scale the image
    const scale = 1 + (Math.random() * 2 - 1) * scaleRange;
    const newSize = Math.round(28 * scale);
    tensor = tf.image.resizeBilinear(tensor, [newSize, newSize]);

    // Pad or crop the image back to 28x28
    if (newSize > 28) {
        const start = Math.floor((newSize - 28) / 2);
        tensor = tf.slice(tensor, [0, start, start, 0], [-1, 28, 28, -1]);
    } else {
        const padAmount = Math.floor((28 - newSize) / 2);
        tensor = tf.pad(tensor, [[0, 0], [padAmount, padAmount], [padAmount, padAmount], [0, 0]]);
    }

    // Ensure the tensor is exactly 28x28
    tensor = tf.image.resizeBilinear(tensor, [28, 28]);

    // Squeeze to remove the extra dimensions
    tensor = tensor.squeeze();

    // Add random noise
    const noise = tf.randomNormal([28, 28], 0, noiseStdDev);
    tensor = tensor.add(noise).clipByValue(0, 1);

    // Denormalize the pixel values back to [0, 255]
    tensor = tensor.mul(255);

    return tensor.flatten().arraySync();
};

const augmentAllImages = (data, rotationRange = 45, scaleRange = 0.2, noiseStdDev = 0.1) => {
    return data.map(row => augmentImage(row, rotationRange, scaleRange, noiseStdDev));
};

// Example usage
const main = async () => {
    console.log("Loading data...");
    const { train_data, test_data } = await loadMNISTData('data/mnist_train.csv', 'data/mnist_test.csv');
    
    const { x: train_x, y: train_y } = splitData(train_data);
    const { x: test_x, y: test_y } = splitData(test_data);

    console.log("Data augmenting...");
    const aug_train_x = augmentAllImages(train_x);
    const aug_test_x = augmentAllImages(test_x);

    console.log("Normalizing Data...");
    const norm_train_x = normalizeData(aug_train_x);
    const norm_test_x = normalizeData(aug_test_x);
    
    console.log('Normalized Train X shape:', [norm_train_x.length, norm_train_x[0].length]);
    console.log('Normalized Test X shape:', [norm_test_x.length, norm_test_x[0].length]);

    
    const trainX = tf.tensor2d(norm_train_x, [norm_train_x.length, 784], 'float32');
    const trainY = tf.tensor1d(train_y, 'float32'); // Convert to float32
    const testX = tf.tensor2d(norm_test_x, [norm_test_x.length, 784], 'float32');
    const testY = tf.tensor1d(test_y, 'float32');
    
    const model = createModel();
    
    model.summary();

    console.log("starting to train...");
    await model.fit(trainX, trainY, {
        epochs: 10,
        validationData: [testX, testY],
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                console.log(`Epoch ${epoch + 1}: loss = ${logs.loss}, accuracy = ${logs.acc}, val_loss = ${logs.val_loss}, val_accuracy = ${logs.val_acc}`);
            }
        }
    });

    
    // Save the model to a JSON object
    const modelJson = await model.save(tf.io.withSaveHandler(async (artifacts) => {
        const modelArtifacts = {
            modelTopology: artifacts.modelTopology,
            weightSpecs: artifacts.weightSpecs,
            weightData: artifacts.weightData,
        };
        return modelArtifacts;
    }));

    // Write the JSON object to a file
    fs.writeFileSync('./model/model.json', JSON.stringify(modelJson.modelTopology));
    fs.writeFileSync('./model/weights.bin', Buffer.from(modelJson.weightData));

    // Replace 'path/to/save/model' with your desired path
    console.log("Model saved successfully!");

};

main();
// 26 load
// 1,4 augmentAllImages
// 3 normalizeData
// 6,40 e1
