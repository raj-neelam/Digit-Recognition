import { Canvas } from './canvas_util.js';

var c = new Canvas(0.30, 0.50)

function grids(c) {
    let lines_x = 28;
    let gap_x = c.width / lines_x;
    for (let i = 0; i <= lines_x; i+=1) {
        c.line(gap_x * i, 0, gap_x * i, c.height, 10, 'white');
    }
    let lines_y = 28;
    let gap_y = c.height / lines_y;
    for (let i = 0; i <= lines_y; i+=1) {
        c.line(0, gap_y * i, c.width, gap_y * i, 10, 'white');
    }
}
function drawGrid(grid, c) {
    let cellWidth = c.width / grid.length;
    let cellHeight = c.height / grid[0].length;
    for (let i = 0; i < grid.length; i++) {
        for (let j = 0; j < grid[i].length; j++) {
            let value = grid[i][j];
            let color = `rgb(${value * 255}, ${value * 255}, ${value * 255})`;
            c.rect(i * cellWidth, j * cellHeight, cellWidth, cellHeight, 0, color);
        }
    }
}

function ShowMouse() {
    if (c.mouse[0] > 0 && c.mouse[1] > 0) {
        c.circle(c.mouse[0], c.mouse[1], 25, 'white');
    }   
}
function updateGridWithMouse(grid, radius, c) {
    let changeOccurred = false;
    if (c.mouse_btn === 0 || c.mouse_btn === 2) {
        let cellWidth = c.width / grid.length;
        let cellHeight = c.height / grid[0].length;
        let mouseX = c.mouse[0];
        let mouseY = c.mouse[1];

        for (let i = 0; i < grid.length; i++) {
            for (let j = 0; j < grid[i].length; j++) {
                let cellCenterX = i * cellWidth + cellWidth / 2;
                let cellCenterY = j * cellHeight + cellHeight / 2;
                let distance = Math.sqrt(Math.pow(cellCenterX - mouseX, 2) + Math.pow(cellCenterY - mouseY, 2));

                if (distance <= radius) {
                    if (c.mouse_btn === 0) {
                        let newValue = Math.max(0.1, 1 - (distance / radius));
                        // newValue = newValue*255; // scale
                        if (grid[i][j] < newValue) {
                            grid[i][j] = newValue;
                            changeOccurred = true;
                        }
                    } else if (c.mouse_btn === 2) {
                        if (grid[i][j] !== 0) {
                            grid[i][j] = 0;
                            changeOccurred = true;
                        }
                    }
                }
            }
        }
    }
    return { changeOccurred, newGrid: grid };
}

function clear_grid() {
    grid = grid.map(row => row.map(() => 0));
}

document.getElementById("reset").addEventListener("click", clear_grid);

let grid = Array.from({ length: 28 }, () => Array(28).fill(0));
// grid = grid.map(row => row.map(() => Math.random()));

let model;
(async () => {
    model = await tf.loadLayersModel('./javascript/model/model.json');
})();

async function classifyInput(data2d) {
    const input = tf.tensor(data2d.flat(), [1, 784]);
    const result = model.predict(input);
    const probabilities = await result.softmax().array();
    return probabilities[0].map(value => value * 300);
}
let prob = Array(10).fill(0);

function animate(){
    requestAnimationFrame(animate)
    c.init()
    // write from here
    grids(c)
    drawGrid(grid, c)
    // ShowMouse()
    let { changeOccurred, newGrid } = updateGridWithMouse(grid, 25, c);
    if (changeOccurred) {
        grid = newGrid;
        // prob = classifyInput(grid);
        // console.log("data", prob);
        classifyInput(grid).then(prob => {
            // console.log("data", prob);
            for (let i = 0; i < prob.length; i++) {
                document.getElementById(['zero', 'one', 'four', 'three', 'two', 'five', 'six', 'seven', 'eight', 'nine'][i]).style.width = prob[i] + '%';
            }
        });
    }
}
animate()
