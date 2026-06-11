(function() {
    document.addEventListener('DOMContentLoaded', () => {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) { console.error("Canvas не найден!"); return; }
        const ctx = canvas.getContext('2d');

        // ========== АДАПТАЦИЯ ПОД ЭКРАН ==========
        let MAP_WIDTH = 16;
        let MAP_HEIGHT = 12;
        let TILE_SIZE = 50;

        function resizeCanvas() {
            const maxSize = Math.min(window.innerWidth - 40, window.innerHeight - 280);
            TILE_SIZE = Math.floor(maxSize / MAP_WIDTH);
            if (TILE_SIZE < 30) TILE_SIZE = 30;
            canvas.width = MAP_WIDTH * TILE_SIZE;
            canvas.height = MAP_HEIGHT * TILE_SIZE;
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            canvas.style.display = 'block';
            canvas.style.margin = '0 auto';
            if (worldMap.length) drawGame();
        }
        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('orientationchange', resizeCanvas);

        // ========== ПЕРЕМЕННЫЕ ==========
        let player = { x: 8, y: 6, health: 20, hunger: 16 };
        let wood = 5, stone = 3, food = 10, coal = 0, copper = 0, iron = 0;
        let arrows = 0;
        let survivedNights = 0;
        let gameActive = true;
        let deathReason = "";

        // ========== ОРУЖИЕ И ИНСТРУМЕНТЫ ==========
        let currentWeaponMode = "melee";
        let weaponDamage = 3;
        let toolTier = 1;
        let equippedToolId = "wood_pick";

        let availableTools = [
            { id: "wood_pick", name: "Деревянная кирка", tier: 1, damage: 2, crafted: true, icon: "🪵", color: "#B57A3B" },
            { id: "stone_pick", name: "Каменная кирка", tier: 2, damage: 4, crafted: false, icon: "🪨", color: "#7E8C8D" },
            { id: "copper_pick", name: "Медная кирка", tier: 3, damage: 6, crafted: false, icon: "🟤", color: "#D98C45" },
            { id: "iron_pick", name: "Железная кирка", tier: 4, damage: 9, crafted: false, icon: "⚙️", color: "#DCDCDC" }
        ];

        let availableWeapons = [
            { id: "melee_default", name: "Кирка", damage: 3, crafted: true, icon: "⛏️" },
            { id: "copper_sword", name: "Медный меч", damage: 6, crafted: false, icon: "🗡️" },
            { id: "iron_sword", name: "Железный меч", damage: 9, crafted: false, icon: "⚔️" },
            { id: "bow", name: "Лук", damage: 8, crafted: false, icon: "🏹" },
            { id: "crossbow", name: "Арбалет", damage: 12, crafted: false, icon: "🎯" }
        ];

        function getToolById(id) { return availableTools.find(t => t.id === id); }
        function hasWeapon(weaponId) { return availableWeapons.find(w => w.id === weaponId)?.crafted === true; }

        // ========== МИР ==========
        let worldMap = [];
        let zombies = [];
        let dayTime = 0;
        let cycleSeconds = 0;
        let lastTick = Date.now();
        let floatingMessages = [];
        let bonusChest = { active: false, x: 0, y: 0, spawnTimer: 60, health: 6, maxHealth: 6 };

        // ========== СТАТЫ БЛОКОВ (с цветами и иконками) ==========
        const blockStats = {
            1: { name: "дерево", baseHealth: 8, drops: { wood: 3 }, toolRequired: 1, icon: "🌲", color: "#5C3E1F", lightColor: "#7C5E2B" },
            2: { name: "камень", baseHealth: 12, drops: { stone: 2 }, toolRequired: 2, icon: "🪨", color: "#6B6B6B", lightColor: "#8F8F8F" },
            3: { name: "ягоды", baseHealth: 4, drops: { food: 4 }, toolRequired: 1, icon: "🍓", color: "#B3470C", lightColor: "#E05E1E" },
            4: { name: "сундук", baseHealth: 6, drops: { random: true }, toolRequired: 1, icon: "📦", color: "#8B5A2B", lightColor: "#D4A373" },
            5: { name: "уголь", baseHealth: 10, drops: { coal: 3 }, toolRequired: 2, icon: "⚫", color: "#3A3A3A", lightColor: "#1A1A1A" },
            6: { name: "медь", baseHealth: 12, drops: { copper: 2 }, toolRequired: 2, icon: "🟤", color: "#B87333", lightColor: "#CD7F45" },
            7: { name: "железо", baseHealth: 15, drops: { iron: 1 }, toolRequired: 3, icon: "⚙️", color: "#8C8C8C", lightColor: "#B0B0B0" }
        };

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
            let weaponName = currentWeaponMode === 'melee' ? 'Кирка/меч' : (currentWeaponMode === 'bow' ? 'Лук' : 'Арбалет');
            if (get('weaponName')) get('weaponName').innerHTML = weaponName;
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

        function showDeathScreen() {
            gameActive = false;
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.9); backdrop-filter: blur(8px);
                display: flex; justify-content: center; align-items: center;
                z-index: 10000; font-family: monospace;
            `;
            overlay.innerHTML = `
                <div style="background: #2A1A0A; border: 3px solid #FF6644; border-radius: 48px; padding: 30px; text-align: center; color: #FFCC88;">
                    <div style="font-size: 2rem;">💀 ВЫ ПОГИБЛИ 💀</div>
                    <div style="margin-top: 15px; font-size: 1.2rem;">${deathReason}</div>
                    <div style="margin-top: 10px;">Выжито дней: ${survivedNights}</div>
                    <button id="restartBtn" style="margin-top: 20px; background: #FF8844; border: none; padding: 10px 30px; border-radius: 40px; font-size: 1.2rem; font-weight: bold; cursor: pointer;">Играть снова</button>
                </div>
            `;
            document.body.appendChild(overlay);
            document.getElementById('restartBtn').onclick = () => location.reload();
        }

        function harvestBlock() {
            if (!gameActive || !worldMap.length) return;
            let bx = player.x, by = player.y;
            
            if (bonusChest.active && bx === bonusChest.x && by === bonusChest.y) {
                bonusChest.health -= (getToolById(equippedToolId)?.damage || 2);
                showFloatingText(`💥 Сундук: ${bonusChest.health}/${bonusChest.maxHealth}`, bx, by, "#ffaa66");
                if (bonusChest.health <= 0) {
                    let r = Math.random();
                    if (r < 0.3) { arrows += 15; showFloatingText("🏹 +15 стрел!", bx, by, "#aaffaa"); }
                    else if (r < 0.6) { food += 12; showFloatingText("🍎 +12 еды!", bx, by, "#aaffaa"); }
                    else { coal += 10; showFloatingText("🔥 +10 угля!", bx, by, "#aaffaa"); }
                    bonusChest.active = false;
                    bonusChest.spawnTimer = 60;
                    updateUI();
                }
                drawGame();
                return;
            }
            
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
            let damage = getToolById(equippedToolId)?.damage || 2;
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

        function rangedAttack(tileX, tileY) {
            if (currentWeaponMode === "melee") {
                showFloatingText("❌ Смени оружие на лук/арбалет", player.x, player.y, "#ff8888");
                return false;
            }
            if ((currentWeaponMode === 'bow' && !hasWeapon('bow')) || (currentWeaponMode === 'crossbow' && !hasWeapon('crossbow'))) {
                showFloatingText("❌ У вас нет этого оружия! Скрафтите его", player.x, player.y, "#ff8888");
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

        function smelt() {
            if (!gameActive) return;
            if (coal > 0 && copper >= 2) {
                copper -= 2;
                iron += 1;
                coal--;
                showFloatingText("⚙️ Железо выплавлено!", player.x, player.y, "#aaffaa");
                updateUI();
                drawGame();
            } else if (coal > 0 && copper >= 1) {
                copper--;
                showFloatingText("🟤 Медь переплавлена, нужно 2 для железа", player.x, player.y, "#ccccaa");
                coal--;
                updateUI();
                drawGame();
            } else {
                showFloatingText(coal > 0 ? "❌ Нет руды!" : "❌ Нет угля!", player.x, player.y, "#ff8888");
            }
        }

        // ========== ИНВЕНТАРЬ ==========
        function openInventory() {
            if (!gameActive) return;
            const modal = document.getElementById('inventoryModal');
            if (!modal) return;
            const slotsContainer = document.getElementById('inventorySlots');
            if (slotsContainer) {
                slotsContainer.innerHTML = '';
                availableTools.forEach(tool => {
                    if (tool.crafted) {
                        const slot = document.createElement('div');
                        slot.className = 'inv-slot';
                        if (equippedToolId === tool.id) slot.classList.add('equipped');
                        slot.innerHTML = `<div class="inv-slot-icon">${tool.icon}</div><div class="inv-slot-name">${tool.name}</div><div class="inv-slot-damage">${tool.damage} урона</div>`;
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
                availableWeapons.forEach(weapon => {
                    if (weapon.crafted) {
                        const slot = document.createElement('div');
                        slot.className = 'inv-slot';
                        let isEquipped = (weapon.id === 'melee_default' && currentWeaponMode === 'melee') ||
                                         (weapon.id === 'bow' && currentWeaponMode === 'bow') ||
                                         (weapon.id === 'crossbow' && currentWeaponMode === 'crossbow');
                        if (isEquipped) slot.classList.add('equipped');
                        slot.innerHTML = `<div class="inv-slot-icon">${weapon.icon}</div><div class="inv-slot-name">${weapon.name}</div><div class="inv-slot-damage">${weapon.damage} урона</div>`;
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
            const eqTool = document.getElementById('equippedTool');
            if (eqTool) eqTool.innerHTML = getToolById(equippedToolId)?.name || "Деревянная";
            const eqWeapon = document.getElementById('equippedWeapon');
            if (eqWeapon) {
                let weaponName = currentWeaponMode === 'melee' ? 'Кирка/меч' : (currentWeaponMode === 'bow' ? 'Лук' : 'Арбалет');
                eqWeapon.innerHTML = weaponName;
            }
            modal.style.display = 'flex';
        }

        function closeInventory() {
            const modal = document.getElementById('inventoryModal');
            if (modal) modal.style.display = 'none';
        }

        // ========== ДВИЖЕНИЕ ==========
        let moveDirection = { x: 0, y: 0 };
        let lastMoveTime = 0;
        const MOVE_DELAY = 160;

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

        // ========== ТЕЛЕФОН: ДЖОЙСТИК ==========
        let joystickActive = false;
        let joystickCenter = { x: 0, y: 0 };
        let joystickBase = null;
        let joystickThumb = null;
        let touchStartPos = null;
        let touchTimeout = null;

        function initJoystick() {
            const container = document.createElement('div');
            container.id = 'joystickContainer';
            container.style.cssText = `position:fixed;width:120px;height:120px;z-index:1500;display:none;touch-action:none;left:20px;bottom:100px;`;
            joystickBase = document.createElement('div');
            joystickBase.style.cssText = `width:100%;height:100%;background:rgba(30,30,40,0.75);border-radius:999px;border:2px solid #ffd966;display:flex;justify-content:center;align-items:center;`;
            joystickThumb = document.createElement('div');
            joystickThumb.style.cssText = `width:50px;height:50px;background:#f5e2b0;border-radius:999px;`;
            joystickBase.appendChild(joystickThumb);
            container.appendChild(joystickBase);
            document.body.appendChild(container);

            canvas.addEventListener('touchstart', (e) => {
                if (!gameActive) return;
                e.preventDefault();
                const touch = e.touches[0];
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                let canvasX = (touch.clientX - rect.left) * scaleX;
                let canvasY = (touch.clientY - rect.top) * scaleY;
                let tileX = Math.floor(canvasX / TILE_SIZE);
                let tileY = Math.floor(canvasY / TILE_SIZE);
                
                touchStartPos = { x: touch.clientX, y: touch.clientY, tileX, tileY };
                touchTimeout = setTimeout(() => {
                    container.style.display = 'block';
                    const rectC = container.getBoundingClientRect();
                    joystickCenter.x = rectC.left + rectC.width / 2;
                    joystickCenter.y = rectC.top + rectC.height / 2;
                    joystickActive = true;
                    moveDirection = { x: 0, y: 0 };
                }, 200);
            });

            canvas.addEventListener('touchmove', (e) => {
                if (!touchStartPos || !gameActive) return;
                e.preventDefault();
                const touch = e.touches[0];
                let dx = touch.clientX - touchStartPos.x;
                let dy = touch.clientY - touchStartPos.y;
                if (Math.abs(dx) > 15 || Math.abs(dy) > 15) {
                    if (touchTimeout) clearTimeout(touchTimeout);
                    if (joystickActive) {
                        let angle = Math.atan2(dy, dx);
                        let dist = Math.min(Math.hypot(dx, dy), 50);
                        let offsetX = Math.cos(angle) * dist;
                        let offsetY = Math.sin(angle) * dist;
                        joystickThumb.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
                        moveDirection.x = Math.cos(angle) * (dist / 50);
                        moveDirection.y = Math.sin(angle) * (dist / 50);
                    }
                    touchStartPos = null;
                }
            });

            canvas.addEventListener('touchend', () => {
                if (touchTimeout) {
                    clearTimeout(touchTimeout);
                    if (touchStartPos && gameActive) {
                        onTapTile(touchStartPos.tileX, touchStartPos.tileY);
                    }
                }
                joystickActive = false;
                container.style.display = 'none';
                moveDirection = { x: 0, y: 0 };
                if (joystickThumb) joystickThumb.style.transform = 'translate(0px, 0px)';
                touchStartPos = null;
            });
        }

        function updateMovement() {
            if (!gameActive) return;
            if (moveDirection.x !== 0 || moveDirection.y !== 0) {
                let now = Date.now();
                if (now - lastMoveTime >= MOVE_DELAY) {
                    let dx = Math.abs(moveDirection.x) > 0.3 ? (moveDirection.x > 0 ? 1 : -1) : 0;
                    let dy = Math.abs(moveDirection.y) > 0.3 ? (moveDirection.y > 0 ? 1 : -1) : 0;
                    if (dx !== 0 || dy !== 0) tryMove(dx, dy);
                    lastMoveTime = now;
                }
            }
            requestAnimationFrame(updateMovement);
        }

        // ========== КЛАВИАТУРА ПК ==========
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

        // ========== ИГРОВОЙ ЦИКЛ ==========
        function gameLoop() {
            if (!gameActive) {
                requestAnimationFrame(gameLoop);
                return;
            }
            let now = Date.now();
            if (now - lastTick >= 1000) {
                lastTick = now;
                cycleSeconds++;
                if (cycleSeconds >= 45) {
                    cycleSeconds = 0;
                    dayTime = 1 - dayTime;
                    if (dayTime === 0) { 
                        survivedNights++; 
                        zombies = []; 
                    } else {
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
                        bonusChest.health = 6;
                        bonusChest.maxHealth = 6;
                        bonusChest.spawnTimer = 60;
                        showFloatingText("✨ Бонусный сундук появился!", bonusChest.x, bonusChest.y, "#ffaa44");
                        updateUI();
                    }
                }
                if (dayTime === 0 && player.hunger > 0 && Math.random() < 0.3) { 
                    player.hunger--; 
                    updateUI(); 
                }
                if (player.hunger <= 0) {
                    player.health = Math.max(0, player.health - 1);
                    updateUI();
                    if (player.health <= 0) {
                        deathReason = "💀 Вы умерли от голода!";
                        showDeathScreen();
                        return;
                    }
                }
                
                for (let i = 0; i < zombies.length; i++) {
                    let z = zombies[i];
                    let dx = Math.sign(player.x - z.x);
                    let dy = Math.sign(player.y - z.y);
                    if (Math.abs(player.x - z.x) <= 1 && Math.abs(player.y - z.y) <= 1) {
                        player.health = Math.max(0, player.health - 4);
                        showFloatingText(`💔 Зомби атакует! -4`, player.x, player.y, "#ff5555");
                        updateUI();
                        if (player.health <= 0) {
                            deathReason = "🧟 Вас убили зомби!";
                            showDeathScreen();
                            return;
                        }
                    } else {
                        let newX = z.x + dx;
                        let newY = z.y + dy;
                        if (newX >= 0 && newX < MAP_WIDTH && newY >= 0 && newY < MAP_HEIGHT) {
                            z.x = newX;
                            z.y = newY;
                        }
                    }
                }
                drawGame();
            }
            drawGame();
            requestAnimationFrame(gameLoop);
        }

        // ========== ОТРИСОВКА (КРАСИВАЯ) ==========
        function drawGame() {
            if (!ctx || !worldMap.length) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let row = 0; row < MAP_HEIGHT; row++) {
                for (let col = 0; col < MAP_WIDTH; col++) {
                    let b = worldMap[row]?.[col];
                    if (!b) continue;
                    let x = col * TILE_SIZE, y = row * TILE_SIZE;
                    if (b.type === 0) {
                        ctx.fillStyle = '#5F7E4A';
                        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = '#6F9E55';
                        ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                    } else {
                        let stats = blockStats[b.type];
                        ctx.fillStyle = stats.color;
                        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = stats.lightColor;
                        ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                        ctx.fillStyle = 'white';
                        ctx.font = `${TILE_SIZE * 0.5}px monospace`;
                        ctx.fillText(stats.icon, x + TILE_SIZE * 0.25, y + TILE_SIZE * 0.7);
                        if (b.health < b.maxHealth) {
                            ctx.fillStyle = '#FFAA44';
                            ctx.fillRect(x + 5, y + 2, (b.health / b.maxHealth) * (TILE_SIZE - 10), 4);
                        }
                    }
                }
            }
            if (bonusChest.active && worldMap[bonusChest.y]?.[bonusChest.x]?.type === 0) {
                let x = bonusChest.x * TILE_SIZE, y = bonusChest.y * TILE_SIZE;
                ctx.fillStyle = '#DAA520';
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#FFD700';
                ctx.font = `${TILE_SIZE * 0.5}px monospace`;
                ctx.fillText('🎁', x + TILE_SIZE * 0.25, y + TILE_SIZE * 0.7);
                ctx.fillStyle = '#FFAA44';
                ctx.fillRect(x + 5, y + 2, (bonusChest.health / bonusChest.maxHealth) * (TILE_SIZE - 10), 4);
            }
            let px = player.x * TILE_SIZE, py = player.y * TILE_SIZE;
            let tool = getToolById(equippedToolId);
            ctx.fillStyle = "#4C7A4A";
            ctx.fillRect(px + 6, py + 12, TILE_SIZE - 12, TILE_SIZE - 18);
            ctx.fillStyle = "#3B2F2A";
            ctx.fillRect(px + 6, py + TILE_SIZE - 12, TILE_SIZE - 12, 6);
            ctx.fillStyle = "#E0AA7A";
            ctx.fillRect(px + 10, py + 4, TILE_SIZE - 20, TILE_SIZE - 24);
            ctx.fillStyle = "#2E241F";
            ctx.fillRect(px + 16, py + 10, 4, 4);
            ctx.fillRect(px + TILE_SIZE - 20, py + 10, 4, 4);
            ctx.fillStyle = "#1F1408";
            ctx.fillRect(px + 10, py + 2, TILE_SIZE - 20, 5);
            ctx.fillStyle = tool?.color || "#B57A3B";
            ctx.fillRect(px + TILE_SIZE - 14, py + TILE_SIZE - 20, 8, 16);
            zombies.forEach(z => {
                let zx = z.x * TILE_SIZE, zy = z.y * TILE_SIZE;
                ctx.fillStyle = "#2F6B3A";
                ctx.fillRect(zx + 4, zy + 8, TILE_SIZE - 8, TILE_SIZE - 12);
                ctx.fillStyle = "#1F3A1A";
                ctx.fillRect(zx + 12, zy + 4, TILE_SIZE - 24, 8);
                ctx.fillStyle = "#000";
                ctx.fillRect(zx + 14, zy + 16, 4, 4);
                ctx.fillRect(zx + TILE_SIZE - 18, zy + 16, 4, 4);
                ctx.fillStyle = "#AA0000";
                ctx.fillRect(zx + 5, zy + 2, (z.health / 20) * (TILE_SIZE - 10), 4);
            });
            floatingMessages = floatingMessages.filter(m => { m.life -= 0.03; m.y -= 1; return m.life > 0; });
            floatingMessages.forEach(m => {
                ctx.font = "bold 14px monospace";
                ctx.fillStyle = m.color;
                ctx.fillText(m.text, m.x - 20, m.y - 12);
            });
            if (dayTime === 1) { 
                ctx.fillStyle = "rgba(0,0,40,0.5)"; 
                ctx.fillRect(0, 0, canvas.width, canvas.height); 
            }
        }

        function renderCrafting() {
            const grid = document.getElementById('craftGrid');
            if (!grid) return;
            grid.innerHTML = '';
            recipes.forEach(rec => {
                let btn = document.createElement('button');
                btn.innerText = rec.name;
                btn.className = 'craft-btn';
                btn.onclick = () => {
                    if (!gameActive) return;
                    let ok = true;
                    for (let [mat, amt] of Object.entries(rec.need)) {
                        if (mat === 'stone' && stone < amt) ok = false;
                        if (mat === 'wood' && wood < amt) ok = false;
                        if (mat === 'iron' && iron < amt) ok = false;
                        if (mat === 'copper' && copper < amt) ok = false;
                        if (mat === 'food' && food < amt) ok = false;
                    }
                    if (!ok) { 
                        showFloatingText("❌ Не хватает ресурсов!", player.x, player.y, "#ff8888");
                        return; 
                    }
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
                        showFloatingText(`✨ Вы скрафтили ${tool.name}!`, player.x, player.y, "#aaffaa");
                    }
                    if (rec.result.weaponId) {
                        let weapon = availableWeapons.find(w => w.id === rec.result.weaponId);
                        if (weapon) weapon.crafted = true;
                        if (rec.result.extraArrows) arrows += rec.result.extraArrows;
                        showFloatingText(`✨ Вы скрафтили ${weapon.name}!`, player.x, player.y, "#aaffaa");
                    }
                    if (rec.result.hungerHeal) {
                        player.hunger = Math.min(20, player.hunger + rec.result.hungerHeal);
                        showFloatingText(`🍞 Вы восстановили голод!`, player.x, player.y, "#aaffaa");
                    }
                    updateUI();
                    drawGame();
                };
                grid.appendChild(btn);
            });
        }

        // ========== КНОПКИ ==========
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

        let nextWeaponBtn = document.getElementById('nextWeaponBtn');
        if (!nextWeaponBtn) {
            const weaponBtn = document.createElement('button');
            weaponBtn.id = 'nextWeaponBtn';
            weaponBtn.className = 'action-btn';
            weaponBtn.innerHTML = '🗡️ Сменить оружие';
            const actionsDiv = document.querySelector('.action-buttons');
            if (actionsDiv) actionsDiv.appendChild(weaponBtn);
            nextWeaponBtn = document.getElementById('nextWeaponBtn');
        }
        if (nextWeaponBtn) {
            nextWeaponBtn.onclick = () => {
                if (!gameActive) return;
                const weapons = ['melee', 'bow', 'crossbow'];
                let idx = weapons.indexOf(currentWeaponMode);
                let attempts = 0;
                do {
                    idx = (idx + 1) % weapons.length;
                    attempts++;
                    if (attempts > 3) break;
                } while (weapons[idx] !== 'melee' && !hasWeapon(weapons[idx]));
                currentWeaponMode = weapons[idx];
                if (currentWeaponMode === 'melee') weaponDamage = 3;
                else if (currentWeaponMode === 'bow') weaponDamage = 8;
                else if (currentWeaponMode === 'crossbow') weaponDamage = 12;
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
