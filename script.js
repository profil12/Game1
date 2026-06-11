(function() {
    document.addEventListener('DOMContentLoaded', () => {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) {
            console.error("Canvas не найден!");
            return;
        }
        const ctx = canvas.getContext('2d');

        // ========== РАЗМЕРЫ МИРА ==========
        let MAP_WIDTH = 16;
        let MAP_HEIGHT = 12;
        let TILE_SIZE = 50;

        // ========== ИГРОК ==========
        let player = { x: 8, y: 6, health: 20, hunger: 16 };
        let wood = 5, stone = 3, food = 10, coal = 0, copper = 0, iron = 0;
        let arrows = 0;
        let survivedNights = 0;

        // ========== ОРУЖИЕ И ИНСТРУМЕНТЫ ==========
        let currentWeaponMode = "melee";
        let weaponDamage = 3;
        let toolTier = 1;
        let equippedToolId = "wood_pick";

        let availableTools = [
            { id: "wood_pick", name: "Деревянная кирка", tier: 1, damage: 2, crafted: true },
            { id: "stone_pick", name: "Каменная кирка", tier: 2, damage: 4, crafted: false },
            { id: "copper_pick", name: "Медная кирка", tier: 3, damage: 6, crafted: false },
            { id: "iron_pick", name: "Железная кирка", tier: 4, damage: 9, crafted: false }
        ];

        let availableWeapons = [
            { id: "melee_default", name: "Кирка", damage: 3, crafted: true },
            { id: "copper_sword", name: "Медный меч", damage: 6, crafted: false },
            { id: "iron_sword", name: "Железный меч", damage: 9, crafted: false },
            { id: "bow", name: "Лук", damage: 8, crafted: false },
            { id: "crossbow", name: "Арбалет", damage: 12, crafted: false }
        ];

        function getToolById(id) { return availableTools.find(t => t.id === id); }
        function getWeaponById(id) { return availableWeapons.find(w => w.id === id); }

        // ========== МИР И ЗОМБИ ==========
        let worldMap = [];
        let zombies = [];
        let dayTime = 0;
        let cycleSeconds = 0;
        let lastTick = Date.now();
        let gameActive = true;
        let floatingMessages = [];
        let bonusChest = { active: false, x: 0, y: 0, spawnTimer: 60 };

        // ========== СТАТЫ БЛОКОВ ==========
        const blockStats = {
            1: { name: "дерево", baseHealth: 8, drops: { wood: 3 }, toolRequired: 1 },
            2: { name: "камень", baseHealth: 12, drops: { stone: 2 }, toolRequired: 2 },
            3: { name: "ягоды", baseHealth: 4, drops: { food: 4 }, toolRequired: 1 },
            4: { name: "сундук", baseHealth: 6, drops: { random: true }, toolRequired: 1 },
            5: { name: "уголь", baseHealth: 10, drops: { coal: 3 }, toolRequired: 2 },
            6: { name: "медь", baseHealth: 12, drops: { copper: 2 }, toolRequired: 2 },
            7: { name: "железо", baseHealth: 15, drops: { iron: 1 }, toolRequired: 3 }
        };

        // ========== РЕЦЕПТЫ ==========
        const recipes = [
            { name: "Каменная кирка", need: { stone: 3, wood: 2 }, result: { toolId: "stone_pick" } },
            { name: "Медная кирка", need: { copper: 4, wood: 2 }, result: { toolId: "copper_pick" } },
            { name: "Железная кирка", need: { iron: 4, wood: 2 }, result: { toolId: "iron_pick" } },
            { name: "Медный меч", need: { copper: 3, wood: 1 }, result: { weaponId: "copper_sword" } },
            { name: "Железный меч", need: { iron: 3, wood: 1 }, result: { weaponId: "iron_sword" } },
            { name: "Лук (20 стрел)", need: { wood: 3, stone: 2 }, result: { weaponId: "bow", extraArrows: 20 } },
            { name: "Арбалет (15 стрел)", need: { wood: 4, iron: 2 }, result: { weaponId: "crossbow", extraArrows: 15 } },
            { name: "Хлеб 🍞", need: { food: 6 }, result: { hungerHeal: 8 } }
        ];

        // ========== ИНИЦИАЛИЗАЦИЯ МИРА ==========
        function generateWorld() {
            worldMap = Array(MAP_HEIGHT).fill().map(() => Array(MAP_WIDTH).fill().map(() => ({ type: 0, health: 0, maxHealth: 0 })));
            function setBlock(type, x, y) {
                if (worldMap[y][x].type === 0) {
                    worldMap[y][x] = { type, health: blockStats[type].baseHealth, maxHealth: blockStats[type].baseHealth };
                    return true;
                }
                return false;
            }
            for (let t = 0; t < 25; t++) setBlock(1, 2 + Math.floor(Math.random() * (MAP_WIDTH - 4)), 2 + Math.floor(Math.random() * (MAP_HEIGHT - 4)));
            for (let s = 0; s < 14; s++) setBlock(2, 1 + Math.floor(Math.random() * (MAP_WIDTH - 2)), 1 + Math.floor(Math.random() * (MAP_HEIGHT - 2)));
            for (let b = 0; b < 20; b++) setBlock(3, 1 + Math.floor(Math.random() * (MAP_WIDTH - 2)), 1 + Math.floor(Math.random() * (MAP_HEIGHT - 2)));
            for (let c = 0; c < 10; c++) setBlock(5, 1 + Math.floor(Math.random() * (MAP_WIDTH - 2)), 1 + Math.floor(Math.random() * (MAP_HEIGHT - 2)));
            for (let cp = 0; cp < 8; cp++) setBlock(6, 1 + Math.floor(Math.random() * (MAP_WIDTH - 2)), 1 + Math.floor(Math.random() * (MAP_HEIGHT - 2)));
            for (let i = 0; i < 6; i++) setBlock(7, 1 + Math.floor(Math.random() * (MAP_WIDTH - 2)), 1 + Math.floor(Math.random() * (MAP_HEIGHT - 2)));
            let placed = false;
            while (!placed) {
                let x = 2 + Math.floor(Math.random() * (MAP_WIDTH - 4)), y = 2 + Math.floor(Math.random() * (MAP_HEIGHT - 4));
                if (setBlock(4, x, y)) placed = true;
            }
        }

        // ========== UI ==========
        function updateUI() {
            const get = (id) => document.getElementById(id);
            if (get('healthValue')) get('healthValue').innerHTML = player.health;
            if (get('hungerValue')) get('hungerValue').innerHTML = player.hunger;
            if (get('woodCount')) get('woodCount').innerHTML = wood;
            if (get('stoneCount')) get('stoneCount').innerHTML = stone;
            if (get('foodCount')) get('foodCount').innerHTML = food;
            if (get('coalCount')) get('coalCount').innerHTML = coal;
            if (get('copperCount')) get('copperCount').innerHTML = copper;
            if (get('ironCount')) get('ironCount').innerHTML = iron;
            if (get('arrowCount')) get('arrowCount').innerHTML = arrows;
            let tool = getToolById(equippedToolId);
            if (get('toolLevel')) get('toolLevel').innerHTML = tool ? tool.name : "Деревянная";
            let weapon = availableWeapons.find(w => w.id === (currentWeaponMode === 'melee' ? 'melee_default' : currentWeaponMode));
            if (get('weaponName')) get('weaponName').innerHTML = weapon ? weapon.name : "Кирка";
            if (get('timeLeft')) get('timeLeft').innerHTML = (45 - cycleSeconds) + "с";
            if (get('dayIcon')) get('dayIcon').innerHTML = dayTime === 0 ? "🌞" : "🌙";
            if (get('dayPhase')) get('dayPhase').innerHTML = dayTime === 0 ? "День" : "Ночь";
            if (get('nightCount')) get('nightCount').innerHTML = `Дней: ${survivedNights}`;
            if (bonusChest.active) {
                if (get('bonusTime')) get('bonusTime').innerHTML = "ГОТОВ!";
            } else {
                if (get('bonusTime')) get('bonusTime').innerHTML = Math.ceil(bonusChest.spawnTimer) + "с";
            }
        }

        function showFloatingText(text, x, y, color = "#ffd966") {
            floatingMessages.push({ text, x: x * TILE_SIZE + 25, y: y * TILE_SIZE, life: 1.0, color });
        }

        // ========== ДОБЫЧА БЛОКА ==========
        function harvestBlock() {
            let bx = player.x, by = player.y;
            let block = worldMap[by]?.[bx];
            if (!block || block.type === 0) {
                showFloatingText("🌿 Пусто", bx, by, "#aaa");
                return;
            }
            let stats = blockStats[block.type];
            if (stats.toolRequired > toolTier) {
                showFloatingText("❌ Слишком крепко", bx, by, "#ff8888");
                return;
            }
            let tool = getToolById(equippedToolId);
            let damage = tool ? tool.damage : 2;
            block.health -= damage;
            if (block.health <= 0) {
                let drops = stats.drops;
                if (drops) {
                    if (drops.wood) wood += drops.wood;
                    if (drops.stone) stone += drops.stone;
                    if (drops.food) food += drops.food;
                    if (drops.coal) coal += drops.coal;
                    if (drops.copper) copper += drops.copper;
                    if (drops.iron) iron += drops.iron;
                    if (drops.random) {
                        let r = Math.random();
                        if (r < 0.3) { arrows += 12; showFloatingText("🏹 +12 стрел", bx, by, "#aaffaa"); }
                        else if (r < 0.5) { food += 8; showFloatingText("🍎 +8 еды", bx, by, "#aaffaa"); }
                        else { coal += 5; showFloatingText("🔥 +5 угля", bx, by, "#aaffaa"); }
                    }
                }
                worldMap[by][bx] = { type: 0, health: 0, maxHealth: 0 };
                updateUI();
                showFloatingText("✓ Сломано", bx, by, "#aaffaa");
            } else {
                showFloatingText(`💥 ${damage} | ост: ${block.health}`, bx, by, "#ffaa66");
            }
            drawGame();
        }

        // ========== БЛИЖНИЙ БОЙ ==========
        function meleeAttackZombie() {
            for (let i = 0; i < zombies.length; i++) {
                let z = zombies[i];
                if (Math.abs(z.x - player.x) <= 1 && Math.abs(z.y - player.y) <= 1) {
                    z.health -= weaponDamage;
                    showFloatingText(`🗡️ ${weaponDamage}`, z.x, z.y, "#ffaa66");
                    if (z.health <= 0) {
                        zombies.splice(i, 1);
                        showFloatingText("☠️ Зомби убит", z.x, z.y, "#aaffaa");
                    }
                    drawGame();
                    return true;
                }
            }
            return false;
        }

        // ========== ДАЛЬНИЙ БОЙ ==========
        function rangedAttack(tileX, tileY) {
            if (currentWeaponMode === "melee") {
                showFloatingText("❌ Смени оружие на лук/арбалет", player.x, player.y, "#ff8888");
                return false;
            }
            if (arrows <= 0) {
                showFloatingText("❌ Нет стрел!", player.x, player.y, "#ff8888");
                return false;
            }
            let targetZombie = null;
            for (let i = 0; i < zombies.length; i++) {
                if (zombies[i].x === tileX && zombies[i].y === tileY) {
                    targetZombie = zombies[i];
                    break;
                }
            }
            if (!targetZombie) return false;
            let damage = (currentWeaponMode === "bow") ? 8 : 12;
            arrows--;
            targetZombie.health -= damage;
            showFloatingText(`🏹 ${damage}`, tileX, tileY, "#ffaa66");
            if (targetZombie.health <= 0) {
                zombies = zombies.filter(z => z !== targetZombie);
                showFloatingText("☠️ Зомби убит", tileX, tileY, "#aaffaa");
            }
            updateUI();
            drawGame();
            return true;
        }

        // ========== ОБРАБОТКА ТАПА ==========
        function onTapTile(tileX, tileY) {
            for (let z of zombies) {
                if (z.x === tileX && z.y === tileY) {
                    if (currentWeaponMode !== "melee") {
                        rangedAttack(tileX, tileY);
                    } else {
                        if (Math.abs(player.x - tileX) <= 1 && Math.abs(player.y - tileY) <= 1) {
                            meleeAttackZombie();
                        } else {
                            showFloatingText("❌ Подойди ближе", player.x, player.y, "#ff8888");
                        }
                    }
                    return;
                }
            }
            harvestBlock();
        }

        // ========== ПЕЧЬ ==========
        function smelt() {
            if (coal > 0) {
                if (copper >= 2) {
                    copper -= 2;
                    iron += 1;
                    coal--;
                    showFloatingText("⚙️ Железо выплавлено!", player.x, player.y, "#aaffaa");
                    updateUI();
                    drawGame();
                } else if (copper >= 1) {
                    copper--;
                    showFloatingText("🟤 Медь переплавлена, нужно 2 для железа", player.x, player.y, "#ccccaa");
                    coal--;
                    updateUI();
                    drawGame();
                } else {
                    showFloatingText("❌ Нет руды для плавки!", player.x, player.y, "#ff8888");
                }
            } else {
                showFloatingText("❌ Нет угля!", player.x, player.y, "#ff8888");
            }
        }

        // ========== ИНВЕНТАРЬ ==========
        function openInventory() {
            const modal = document.getElementById('inventoryModal');
            if (!modal) return;
            
            const slotsContainer = document.getElementById('inventorySlots');
            if (slotsContainer) {
                slotsContainer.innerHTML = '';
                // Инструменты
                availableTools.forEach(tool => {
                    if (tool.crafted) {
                        const slot = document.createElement('div');
                        slot.className = 'inv-slot';
                        if (equippedToolId === tool.id) slot.classList.add('equipped');
                        slot.innerHTML = `<div class="inv-slot-icon">${tool.tier === 1 ? '🪵' : (tool.tier === 2 ? '🪨' : (tool.tier === 3 ? '🟤' : '⚙️'))}</div><div class="inv-slot-name">${tool.name}</div><div class="inv-slot-damage">${tool.damage} урона</div>`;
                        slot.onclick = () => {
                            equippedToolId = tool.id;
                            toolTier = tool.tier;
                            showFloatingText(`⚒️ ${tool.name}`, player.x, player.y, "#aaffaa");
                            updateUI();
                            openInventory();
                        };
                        slotsContainer.appendChild(slot);
                    }
                });
                // Оружие
                availableWeapons.forEach(weapon => {
                    if (weapon.crafted) {
                        const slot = document.createElement('div');
                        slot.className = 'inv-slot';
                        let isEquipped = (currentWeaponMode === 'melee' && weapon.id === 'melee_default') ||
                                         (currentWeaponMode === weapon.id);
                        if (isEquipped) slot.classList.add('equipped');
                        slot.innerHTML = `<div class="inv-slot-icon">${weapon.id === 'melee_default' ? '⛏️' : (weapon.id === 'copper_sword' ? '🗡️' : (weapon.id === 'iron_sword' ? '⚔️' : (weapon.id === 'bow' ? '🏹' : '🎯')))}</div><div class="inv-slot-name">${weapon.name}</div><div class="inv-slot-damage">${weapon.damage} урона</div>`;
                        slot.onclick = () => {
                            if (weapon.id === 'melee_default') {
                                currentWeaponMode = 'melee';
                                weaponDamage = weapon.damage;
                            } else if (weapon.id === 'bow') {
                                currentWeaponMode = 'bow';
                                weaponDamage = weapon.damage;
                            } else if (weapon.id === 'crossbow') {
                                currentWeaponMode = 'crossbow';
                                weaponDamage = weapon.damage;
                            } else {
                                currentWeaponMode = 'melee';
                                weaponDamage = weapon.damage;
                            }
                            showFloatingText(`🗡️ ${weapon.name}`, player.x, player.y, "#aaffaa");
                            updateUI();
                            openInventory();
                        };
                        slotsContainer.appendChild(slot);
                    }
                });
            }
            document.getElementById('equippedTool').innerHTML = getToolById(equippedToolId)?.name || "Деревянная";
            let weapon = availableWeapons.find(w => w.id === (currentWeaponMode === 'melee' ? 'melee_default' : currentWeaponMode));
            document.getElementById('equippedWeapon').innerHTML = weapon ? weapon.name : "Кирка";
            modal.style.display = 'flex';
        }

        function closeInventory() {
            const modal = document.getElementById('inventoryModal');
            if (modal) modal.style.display = 'none';
        }

        // ========== ДЖОЙСТИК ==========
        let joystickContainer, joystickBase, joystickThumb;
        let joystickActive = false;
        let joystickCenter = { x: 0, y: 0 };
        let joystickMaxDist = 50;
        let moveDirection = { x: 0, y: 0 };
        let lastMoveTime = 0;
        const MOVE_DELAY = 160;
        let joystickTimeout = null;
        let lastTapX = null, lastTapY = null, wasMoved = false;

        function initJoystick() {
            joystickContainer = document.createElement('div');
            joystickContainer.style.cssText = `position:fixed;width:130px;height:130px;z-index:1500;display:none;touch-action:none;`;
            joystickBase = document.createElement('div');
            joystickBase.style.cssText = `width:100%;height:100%;background:rgba(30,30,40,0.75);backdrop-filter:blur(12px);border-radius:999px;border:2px solid #ffd966aa;display:flex;justify-content:center;align-items:center;`;
            joystickThumb = document.createElement('div');
            joystickThumb.style.cssText = `width:55px;height:55px;background:radial-gradient(circle at 30% 30%, #f5e2b0, #c99e4a);border-radius:999px;position:relative;`;
            joystickBase.appendChild(joystickThumb);
            joystickContainer.appendChild(joystickBase);
            document.body.appendChild(joystickContainer);
            canvas.addEventListener('touchstart', onTouchStart);
            canvas.addEventListener('touchmove', onTouchMove);
            canvas.addEventListener('touchend', onTouchEnd);
            canvas.addEventListener('touchcancel', onTouchEnd);
        }

        function onTouchStart(e) {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            let canvasX = (touch.clientX - rect.left) * scaleX;
            let canvasY = (touch.clientY - rect.top) * scaleY;
            let tileX = Math.floor(canvasX / TILE_SIZE);
            let tileY = Math.floor(canvasY / TILE_SIZE);
            joystickTimeout = setTimeout(() => {
                let x = touch.clientX - 65;
                let y = touch.clientY - 65;
                x = Math.min(window.innerWidth - 130, Math.max(0, x));
                y = Math.min(window.innerHeight - 130, Math.max(20, y));
                joystickContainer.style.left = x + 'px';
                joystickContainer.style.top = y + 'px';
                joystickContainer.style.display = 'block';
                const rectJ = joystickContainer.getBoundingClientRect();
                joystickCenter.x = rectJ.left + rectJ.width / 2;
                joystickCenter.y = rectJ.top + rectJ.height / 2;
                joystickActive = true;
            }, 200);
            lastTapX = tileX;
            lastTapY = tileY;
            wasMoved = false;
        }

        function onTouchMove(e) {
            if (!joystickActive) {
                if (joystickTimeout) clearTimeout(joystickTimeout);
                joystickTimeout = null;
                wasMoved = true;
                return;
            }
            e.preventDefault();
            const touch = e.touches[0];
            let dx = touch.clientX - joystickCenter.x;
            let dy = touch.clientY - joystickCenter.y;
            let dist = Math.min(Math.hypot(dx, dy), joystickMaxDist);
            let angle = Math.atan2(dy, dx);
            let offsetX = Math.cos(angle) * dist;
            let offsetY = Math.sin(angle) * dist;
            joystickThumb.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
            moveDirection.x = Math.cos(angle) * (dist / joystickMaxDist);
            moveDirection.y = Math.sin(angle) * (dist / joystickMaxDist);
            if (dist < 10) { moveDirection.x = 0; moveDirection.y = 0; }
        }

        function onTouchEnd(e) {
            if (joystickTimeout) { clearTimeout(joystickTimeout); joystickTimeout = null; }
            if (joystickActive) {
                joystickActive = false;
                joystickContainer.style.display = 'none';
                joystickThumb.style.transform = 'translate(-50%, -50%)';
                moveDirection.x = 0; moveDirection.y = 0;
            } else if (!wasMoved && lastTapX !== null && lastTapX !== undefined) {
                onTapTile(lastTapX, lastTapY);
            }
            wasMoved = false; lastTapX = null; lastTapY = null;
        }

        // ========== ДВИЖЕНИЕ ==========
        function tryMove(dx, dy) {
            if (!gameActive) return false;
            let nx = player.x + dx, ny = player.y + dy;
            if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
                player.x = nx; player.y = ny;
                drawGame();
                return true;
            }
            return false;
        }

        function updateMovement() {
            if (!gameActive) return;
            if (moveDirection.x === 0 && moveDirection.y === 0) return;
            let now = Date.now();
            if (now - lastMoveTime >= MOVE_DELAY) {
                let dx = Math.abs(moveDirection.x) > 0.3 ? (moveDirection.x > 0 ? 1 : -1) : 0;
                let dy = Math.abs(moveDirection.y) > 0.3 ? (moveDirection.y > 0 ? 1 : -1) : 0;
                if (dx !== 0 || dy !== 0) tryMove(dx, dy);
                lastMoveTime = now;
            }
            requestAnimationFrame(updateMovement);
        }

        // ========== КЛАВИАТУРА ==========
        let keys = {};
        window.addEventListener('keydown', (e) => {
            if (!gameActive) return;
            let k = e.key.toLowerCase();
            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 's', 'a', 'd'].includes(k)) {
                e.preventDefault();
                keys[k] = true;
                updateKeyboardMovement();
            }
            if (k === ' ' || k === 'e') { e.preventDefault(); harvestBlock(); }
            if (k === 'i') { e.preventDefault(); openInventory(); }
        });
        window.addEventListener('keyup', (e) => { let k = e.key.toLowerCase(); delete keys[k]; updateKeyboardMovement(); });

        function updateKeyboardMovement() {
            let dx = 0, dy = 0;
            if (keys['arrowup'] || keys['w']) dy = -1;
            if (keys['arrowdown'] || keys['s']) dy = 1;
            if (keys['arrowleft'] || keys['a']) dx = -1;
            if (keys['arrowright'] || keys['d']) dx = 1;
            if (dx !== 0 || dy !== 0) {
                let now = Date.now();
                if (now - lastMoveTime >= MOVE_DELAY) { tryMove(dx, dy); lastMoveTime = now; }
            }
        }

        // ========== ОСНОВНОЙ ЦИКЛ ==========
        function gameLoop() {
            let now = Date.now();
            if (now - lastTick >= 1000) {
                lastTick = now;
                cycleSeconds++;
                if (cycleSeconds >= 45) {
                    cycleSeconds = 0;
                    dayTime = 1 - dayTime;
                    if (dayTime === 0) { survivedNights++; zombies = []; }
                    else {
                        for (let i = 0; i < 3; i++) {
                            let x = Math.min(MAP_WIDTH - 1, Math.max(0, player.x + (Math.random() > 0.5 ? 3 : -3)));
                            let y = Math.min(MAP_HEIGHT - 1, Math.max(0, player.y + (Math.random() > 0.5 ? 2 : -2)));
                            zombies.push({ x, y, health: 20 });
                        }
                    }
                    updateUI();
                }
                if (!bonusChest.active) {
                    bonusChest.spawnTimer--;
                    if (bonusChest.spawnTimer <= 0) {
                        bonusChest.active = true;
                        bonusChest.x = Math.floor(Math.random() * (MAP_WIDTH - 2)) + 1;
                        bonusChest.y = Math.floor(Math.random() * (MAP_HEIGHT - 2)) + 1;
                        bonusChest.spawnTimer = 60;
                        showFloatingText("✨ Бонусный сундук появился!", bonusChest.x, bonusChest.y, "#ffaa44");
                    }
                    updateUI();
                }
                if (dayTime === 0 && player.hunger > 0 && Math.random() < 0.3) { player.hunger--; updateUI(); }
                if (player.hunger <= 0) {
                    player.health = Math.max(0, player.health - 1);
                    updateUI();
                    if (player.health <= 0) { gameActive = false; alert("💀 Вы погибли! Обновите страницу."); }
                }
                drawGame();
            }
            drawGame();
            requestAnimationFrame(gameLoop);
        }

        // ========== ОТРИСОВКА ==========
        function drawGame() {
            if (!ctx || !worldMap.length) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let row = 0; row < MAP_HEIGHT; row++) {
                for (let col = 0; col < MAP_WIDTH; col++) {
                    let b = worldMap[row]?.[col];
                    if (!b) continue;
                    let x = col * TILE_SIZE, y = row * TILE_SIZE;
                    if (b.type === 0) {
                        ctx.fillStyle = '#5f7e4a';
                        ctx.fillRect(x, y, TILE_SIZE - 1, TILE_SIZE - 1);
                    } else if (b.type === 1) {
                        ctx.fillStyle = '#5c3e1f';
                        ctx.fillRect(x, y, TILE_SIZE - 1, TILE_SIZE - 1);
                        ctx.fillStyle = '#7c5e2b';
                        ctx.fillRect(x + 8, y + 10, TILE_SIZE - 16, TILE_SIZE - 10);
                    } else if (b.type === 2) {
                        ctx.fillStyle = '#6b6b6b';
                        ctx.fillRect(x, y, TILE_SIZE - 1, TILE_SIZE - 1);
                    } else if (b.type === 3) {
                        ctx.fillStyle = '#b3470c';
                        ctx.fillRect(x, y, TILE_SIZE - 1, TILE_SIZE - 1);
                        ctx.fillStyle = '#ffbb77';
                        ctx.fillText('🍓', x + 18, y + 30);
                    } else if (b.type === 4) {
                        ctx.fillStyle = '#8b5a2b';
                        ctx.fillRect(x, y, TILE_SIZE - 1, TILE_SIZE - 1);
                        ctx.fillStyle = '#f7d44a';
                        ctx.fillText('✨', x + 22, y + 30);
                    } else if (b.type === 5) {
                        ctx.fillStyle = '#3a3a3a';
                        ctx.fillRect(x, y, TILE_SIZE - 1, TILE_SIZE - 1);
                    } else if (b.type === 6) {
                        ctx.fillStyle = '#b87333';
                        ctx.fillRect(x, y, TILE_SIZE - 1, TILE_SIZE - 1);
                    } else if (b.type === 7) {
                        ctx.fillStyle = '#8c8c8c';
                        ctx.fillRect(x, y, TILE_SIZE - 1, TILE_SIZE - 1);
                    }
                }
            }
            if (bonusChest.active && worldMap[bonusChest.y]?.[bonusChest.x]?.type === 0) {
                let x = bonusChest.x * TILE_SIZE, y = bonusChest.y * TILE_SIZE;
                ctx.fillStyle = '#d4af37';
                ctx.fillRect(x + 8, y + 10, 34, 26);
                ctx.fillStyle = '#ffd966';
                ctx.fillText('🎁', x + 22, y + 32);
            }
            let px = player.x * TILE_SIZE, py = player.y * TILE_SIZE;
            ctx.fillStyle = "#4c7a4a";
            ctx.fillRect(px + 12, py + 20, 26, 18);
            ctx.fillStyle = "#e0aa7a";
            ctx.fillRect(px + 14, py + 6, 22, 18);
            ctx.fillStyle = "#2e241f";
            ctx.fillRect(px + 20, py + 10, 4, 4);
            ctx.fillRect(px + 26, py + 10, 4, 4);
            zombies.forEach(z => {
                let zx = z.x * TILE_SIZE, zy = z.y * TILE_SIZE;
                ctx.fillStyle = "#2f6b3a";
                ctx.fillRect(zx + 10, zy + 14, 30, 30);
                ctx.fillStyle = "#000";
                ctx.fillRect(zx + 20, zy + 22, 4, 4);
                ctx.fillRect(zx + 26, zy + 22, 4, 4);
                ctx.fillStyle = "#aa0000";
                ctx.fillRect(zx + 5, zy + 2, (z.health / 20) * 40, 5);
            });
            floatingMessages = floatingMessages.filter(m => { m.life -= 0.03; m.y -= 1; return m.life > 0; });
            floatingMessages.forEach(m => {
                ctx.font = "bold 14px monospace";
                ctx.fillStyle = m.color;
                ctx.fillText(m.text, m.x - 20, m.y - 12);
            });
            if (dayTime === 1) { ctx.fillStyle = "rgba(0,0,40,0.6)"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        }

        // ========== АДАПТАЦИЯ ПОД ЭКРАН ==========
        function resizeCanvas() {
            TILE_SIZE = Math.floor(Math.min(window.innerWidth - 80, 600) / MAP_WIDTH);
            if (TILE_SIZE < 30) TILE_SIZE = 30;
            canvas.width = MAP_WIDTH * TILE_SIZE;
            canvas.height = MAP_HEIGHT * TILE_SIZE;
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            drawGame();
        }

        // ========== КРАФТ ==========
        function renderCrafting() {
            const grid = document.getElementById('craftGrid');
            if (!grid) return;
            grid.innerHTML = '';
            recipes.forEach(rec => {
                let btn = document.createElement('button');
                btn.innerText = rec.name;
                btn.className = 'craft-btn';
                btn.onclick = () => {
                    let ok = true;
                    for (let [mat, amt] of Object.entries(rec.need)) {
                        if (mat === 'stone' && stone < amt) ok = false;
                        if (mat === 'wood' && wood < amt) ok = false;
                        if (mat === 'iron' && iron < amt) ok = false;
                        if (mat === 'copper' && copper < amt) ok = false;
                        if (mat === 'food' && food < amt) ok = false;
                    }
                    if (!ok) { alert("❌ Не хватает ресурсов!"); return; }
                    for (let [mat, amt] of Object.entries(rec.need)) {
                        if (mat === 'stone') stone -= amt;
                        if (mat === 'wood') wood -= amt;
                        if (mat === 'iron') iron -= amt;
                        if (mat === 'copper') copper -= amt;
                        if (mat === 'food') food -= amt;
                    }
                    if (rec.result.toolId) {
                        let tool = availableTools.find(t => t.id === rec.result.toolId);
                        if (tool) tool.crafted = true;
                        alert(`✨ Вы скрафтили ${tool.name}!`);
                    }
                    if (rec.result.weaponId) {
                        let weapon = availableWeapons.find(w => w.id === rec.result.weaponId);
                        if (weapon) weapon.crafted = true;
                        if (rec.result.extraArrows) arrows += rec.result.extraArrows;
                        alert(`✨ Вы скрафтили ${weapon.name}!`);
                    }
                    if (rec.result.hungerHeal) {
                        player.hunger = Math.min(20, player.hunger + rec.result.hungerHeal);
                        alert(`🍞 Вы восстановили голод!`);
                    }
                    updateUI();
                    drawGame();
                };
                grid.appendChild(btn);
            });
        }

        // ========== ПОДКЛЮЧАЕМ КНОПКИ ==========
        const actionBtn = document.getElementById('actionBtn');
        if (actionBtn) actionBtn.onclick = () => harvestBlock();
        const furnaceBtn = document.getElementById('furnaceBtn');
        if (furnaceBtn) furnaceBtn.onclick = () => smelt();
        const inventoryBtn = document.getElementById('inventoryBtn');
        if (inventoryBtn) inventoryBtn.onclick = () => openInventory();
        const inventoryToggle = document.getElementById('inventoryToggleBtn');
        if (inventoryToggle) inventoryToggle.onclick = () => openInventory();
        const closeInv = document.getElementById('closeInventoryBtn');
        if (closeInv) closeInv.onclick = () => closeInventory();

        // Кнопка смены оружия (создаём если нет)
        if (!document.getElementById('nextWeaponBtn')) {
            const weaponBtn = document.createElement('button');
            weaponBtn.id = 'nextWeaponBtn';
            weaponBtn.className = 'action-btn';
            weaponBtn.innerHTML = '🗡️ Сменить оружие';
            const actionsDiv = document.querySelector('.action-buttons');
            if (actionsDiv) actionsDiv.appendChild(weaponBtn);
        }
        const nextWeaponBtn = document.getElementById('nextWeaponBtn');
        if (nextWeaponBtn) {
            nextWeaponBtn.onclick = () => {
                const weapons = ['melee', 'bow', 'crossbow'];
                let idx = weapons.indexOf(currentWeaponMode);
                idx = (idx + 1) % weapons.length;
                currentWeaponMode = weapons[idx];
                let weapon = availableWeapons.find(w => w.id === (currentWeaponMode === 'melee' ? 'melee_default' : currentWeaponMode));
                if (weapon) weaponDamage = weapon.damage;
                let name = currentWeaponMode === 'melee' ? 'Кирка/меч' : (currentWeaponMode === 'bow' ? 'Лук' : 'Арбалет');
                showFloatingText(`⚔️ ${name}`, player.x, player.y, "#aaffaa");
                updateUI();
            };
        }

        // ========== ЗАПУСК ==========
        generateWorld();
        renderCrafting();
        updateUI();
        resizeCanvas();
        initJoystick();
        updateMovement();
        gameLoop();
        window.addEventListener('resize', resizeCanvas);
    });
})();
