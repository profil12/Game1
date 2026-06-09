// File: script.js
(function(){
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const TILE_SIZE = 50;
    const MAP_WIDTH = 16;
    const MAP_HEIGHT = 12;

    // ========== СОСТОЯНИЕ ИГРОКА ==========
    let player = { x: 8, y: 6, health: 20, maxHealth: 20, hunger: 20, maxHunger: 20 };
    let wood = 5, stone = 3, food = 10, coal = 0, copper = 0, iron = 0;
    let arrows = 0;
    let survivedNights = 0;  // сколько ночей пережил
    
    // ИНВЕНТАРЬ
    let availableTools = [
        { id: "wood_pick", name: "Деревянная кирка", type: "tool", tier: 1, icon: "🪵", damage: 2, crafted: true },
        { id: "stone_pick", name: "Каменная кирка", type: "tool", tier: 2, icon: "🪨", damage: 4, crafted: false },
        { id: "copper_pick", name: "Медная кирка", type: "tool", tier: 3, icon: "🟤", damage: 6, crafted: false },
        { id: "iron_pick", name: "Железная кирка", type: "tool", tier: 4, icon: "⚙️", damage: 9, crafted: false }
    ];
    let availableWeapons = [
        { id: "melee_default", name: "Кирка (оружие)", type: "weapon", damage: 3, icon: "⛏️", crafted: true },
        { id: "copper_sword", name: "Медный меч", type: "weapon", damage: 6, icon: "🗡️", crafted: false },
        { id: "iron_sword", name: "Железный меч", type: "weapon", damage: 9, icon: "⚔️", crafted: false },
        { id: "bow", name: "Лук", type: "ranged", damage: 8, icon: "🏹", crafted: false, needsArrows: true },
        { id: "crossbow", name: "Арбалет", type: "ranged", damage: 12, icon: "🎯", crafted: false, needsArrows: true }
    ];
    
    let equippedToolId = "wood_pick";
    let equippedWeaponId = "melee_default";
    let currentWeaponMode = "melee";
    let toolTier = 1;
    let weaponDamage = 3;
    
    // ========== МИР ==========
    let worldMap = Array(MAP_HEIGHT).fill().map(() => Array(MAP_WIDTH).fill().map(() => ({ type: 0, health: 0, maxHealth: 0, respawnTimer: null })));
    let zombies = [];
    let nightCount = 1;      // номер текущей ночи (для спавна)
    
    let dayTime = 0;         // 0-день, 1-ночь
    let cycleSeconds = 0;
    let lastTick = Date.now();
    let gameActive = true;
    
    let bonusChest = { active: false, x: 0, y: 0, spawnTimer: 60 };
    
    const blockStats = {
        1: { name: "дерево", baseHealth: 8, drops: { wood: 3 }, toolRequired: 1, respawnDelay: 10000, respawnType: 1 },
        2: { name: "камень", baseHealth: 12, drops: { stone: 2 }, toolRequired: 2, respawnDelay: 12000, respawnType: 2 },
        3: { name: "ягоды", baseHealth: 4, drops: { food: 4 }, toolRequired: 1, respawnDelay: 8000, respawnType: 3 },
        4: { name: "сундук", baseHealth: 6, drops: { random: true }, toolRequired: 1, respawnDelay: null, respawnType: null },
        5: { name: "уголь", baseHealth: 10, drops: { coal: 3 }, toolRequired: 2, respawnDelay: 14000, respawnType: 5 },
        6: { name: "медь", baseHealth: 12, drops: { copper: 2 }, toolRequired: 2, respawnDelay: 14000, respawnType: 6 },
        7: { name: "железо", baseHealth: 15, drops: { iron: 1 }, toolRequired: 3, respawnDelay: 16000, respawnType: 7 }
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

    let floatingMessages = [];

    function getToolById(id) { return availableTools.find(t => t.id === id); }
    function getWeaponById(id) { return availableWeapons.find(w => w.id === id); }
    
    function updateEquippedStats() {
        let tool = getToolById(equippedToolId);
        if(tool) toolTier = tool.tier;
        let weapon = getWeaponById(equippedWeaponId);
        if(weapon) weaponDamage = weapon.damage;
        updateUI();
    }
    
    function equipTool(id) {
        let tool = getToolById(id);
        if(tool && tool.crafted !== false) {
            equippedToolId = id;
            updateEquippedStats();
            showFloatingText(`⚒️ Экипирована ${tool.name}`, player.x, player.y, "#aaffaa");
            renderInventoryUI();
        }
    }
    
    function equipWeapon(id) {
        let weapon = getWeaponById(id);
        if(weapon && weapon.crafted !== false) {
            equippedWeaponId = id;
            if(weapon.type === "ranged") {
                currentWeaponMode = weapon.id === "bow" ? "bow" : "crossbow";
            } else {
                currentWeaponMode = "melee";
            }
            updateEquippedStats();
            showFloatingText(`🗡️ Экипировано ${weapon.name}`, player.x, player.y, "#aaffaa");
            renderInventoryUI();
        }
    }
    
    function unlockTool(id) {
        let tool = availableTools.find(t => t.id === id);
        if(tool) tool.crafted = true;
        renderInventoryUI();
    }
    
    function unlockWeapon(id) {
        let weapon = availableWeapons.find(w => w.id === id);
        if(weapon) weapon.crafted = true;
        renderInventoryUI();
    }

    function generateWorld() {
        for(let i=0; i<MAP_HEIGHT; i++)
            for(let j=0; j<MAP_WIDTH; j++)
                worldMap[i][j] = { type: 0, health: 0, maxHealth: 0, respawnTimer: null };
        
        function setBlock(type, x, y) {
            if(worldMap[y][x].type === 0) {
                worldMap[y][x] = { type, health: blockStats[type].baseHealth, maxHealth: blockStats[type].baseHealth, respawnTimer: null };
                return true;
            }
            return false;
        }
        for(let t=0; t<25; t++) setBlock(1, 2+Math.floor(Math.random()*(MAP_WIDTH-4)), 2+Math.floor(Math.random()*(MAP_HEIGHT-4)));
        for(let s=0; s<14; s++) setBlock(2, 1+Math.floor(Math.random()*(MAP_WIDTH-2)), 1+Math.floor(Math.random()*(MAP_HEIGHT-2)));
        for(let b=0; b<20; b++) setBlock(3, 1+Math.floor(Math.random()*(MAP_WIDTH-2)), 1+Math.floor(Math.random()*(MAP_HEIGHT-2)));
        for(let c=0; c<10; c++) setBlock(5, 1+Math.floor(Math.random()*(MAP_WIDTH-2)), 1+Math.floor(Math.random()*(MAP_HEIGHT-2)));
        for(let cp=0; cp<8; cp++) setBlock(6, 1+Math.floor(Math.random()*(MAP_WIDTH-2)), 1+Math.floor(Math.random()*(MAP_HEIGHT-2)));
        for(let i=0; i<6; i++) setBlock(7, 1+Math.floor(Math.random()*(MAP_WIDTH-2)), 1+Math.floor(Math.random()*(MAP_HEIGHT-2)));
        
        let placed=false;
        while(!placed){
            let x=2+Math.floor(Math.random()*(MAP_WIDTH-4)), y=2+Math.floor(Math.random()*(MAP_HEIGHT-4));
            if(setBlock(4, x, y)) placed=true;
        }
    }

    function scheduleRespawn(x, y, blockType) {
        const stats = blockStats[blockType];
        if(!stats || !stats.respawnDelay) return;
        const timeoutId = setTimeout(() => {
            if(worldMap[y][x].type === 0) {
                worldMap[y][x] = { type: blockType, health: stats.baseHealth, maxHealth: stats.baseHealth, respawnTimer: null };
                drawGame();
            }
        }, stats.respawnDelay);
        worldMap[y][x] = { type: 0, health: 0, maxHealth: 0, respawnTimer: timeoutId };
    }

    function updateUI() {
        document.getElementById('healthValue').innerHTML = player.health;
        document.getElementById('hungerValue').innerHTML = player.hunger;
        document.getElementById('woodCount').innerHTML = wood;
        document.getElementById('stoneCount').innerHTML = stone;
        document.getElementById('foodCount').innerHTML = food;
        document.getElementById('coalCount').innerHTML = coal;
        document.getElementById('copperCount').innerHTML = copper;
        document.getElementById('ironCount').innerHTML = iron;
        document.getElementById('arrowCount').innerHTML = arrows;
        let tool = getToolById(equippedToolId);
        document.getElementById('toolLevel').innerHTML = tool ? tool.name : "Деревянная";
        let weapon = getWeaponById(equippedWeaponId);
        document.getElementById('weaponName').innerHTML = weapon ? `${weapon.name} (${weaponDamage} урона)` : "Кирка";
        let remaining = 45 - cycleSeconds;
        document.getElementById('timeLeft').innerHTML = remaining + "с";
        document.getElementById('dayIcon').innerHTML = dayTime===0 ? "🌞" : "🌙";
        document.getElementById('dayPhase').innerHTML = dayTime===0 ? "День" : "Ночь";
        if(bonusChest.active) document.getElementById('bonusTime').innerHTML = "ГОТОВ!";
        else document.getElementById('bonusTime').innerHTML = Math.ceil(bonusChest.spawnTimer) + "с";
        document.getElementById('nightCount').innerHTML = `📆 Дней: ${survivedNights}`;
    }

    function showFloatingText(text, x, y, color="#ffd966"){
        floatingMessages.push({ text, x: x*TILE_SIZE+25, y: y*TILE_SIZE, life:1.0, color });
    }

    function spawnBonusChest() {
        if(!gameActive) return;
        let freeCells = [];
        for(let i=0; i<MAP_HEIGHT; i++){
            for(let j=0; j<MAP_WIDTH; j++){
                if(worldMap[i][j].type === 0 && !(player.x === j && player.y === i)){
                    freeCells.push({x: j, y: i});
                }
            }
        }
        if(freeCells.length === 0) return;
        let pos = freeCells[Math.floor(Math.random() * freeCells.length)];
        bonusChest.active = true;
        bonusChest.x = pos.x;
        bonusChest.y = pos.y;
        bonusChest.spawnTimer = 60;
        showFloatingText("✨ Бонусный сундук появился! ✨", pos.x, pos.y, "#ffaa44");
        drawGame();
    }

    function openBonusChest() {
        if(!bonusChest.active) return;
        if(player.x === bonusChest.x && player.y === bonusChest.y){
            let reward = Math.random();
            let msg = "";
            if(reward < 0.3) { arrows += 15; msg = "🏹 +15 стрел"; }
            else if(reward < 0.55) { food += 12; msg = "🍎 +12 еды"; }
            else if(reward < 0.75) { coal += 10; msg = "🔥 +10 угля"; }
            else { iron += 3; copper += 4; msg = "⚙️ +3 железо, +4 медь"; }
            showFloatingText(msg, bonusChest.x, bonusChest.y, "#aaffaa");
            bonusChest.active = false;
            updateUI();
            drawGame();
        }
    }

    function meleeAttackDirection(dx, dy) {
        let targetX = player.x + dx;
        let targetY = player.y + dy;
        if(targetX < 0 || targetX >= MAP_WIDTH || targetY < 0 || targetY >= MAP_HEIGHT) return false;
        
        for(let i=0; i<zombies.length; i++){
            if(zombies[i].x === targetX && zombies[i].y === targetY){
                zombies[i].health -= weaponDamage;
                showFloatingText(`🗡️ ${weaponDamage}`, targetX, targetY, "#ffaa66");
                if(zombies[i].health <= 0){
                    zombies.splice(i,1);
                    showFloatingText("☠️ Зомби убит", targetX, targetY, "#aaffaa");
                }
                drawGame();
                return true;
            }
        }
        return false;
    }

    function performAction() {
        if(!gameActive) return;
        if(bonusChest.active && player.x === bonusChest.x && player.y === bonusChest.y){
            openBonusChest();
            return;
        }
        let directions = [[0,-1],[0,1],[-1,0],[1,0]];
        for(let d of directions){
            if(meleeAttackDirection(d[0], d[1])) return;
        }
        harvestResource();
    }

    function harvestResource(){
        let bx=player.x, by=player.y;
        let block = worldMap[by][bx];
        if(block.type===0) { showFloatingText("🌿 Пусто", bx, by, "#aaa"); return; }
        let stats = blockStats[block.type];
        if(!stats) return;
        if(stats.toolRequired > toolTier){
            showFloatingText("❌ Слишком крепко", bx, by, "#ff8888");
            return;
        }
        let tool = getToolById(equippedToolId);
        let damage = tool ? tool.damage : 2;
        block.health -= damage;
        if(block.health <= 0){
            let drops = stats.drops;
            if(drops){
                if(drops.wood) wood += drops.wood;
                if(drops.stone) stone += drops.stone;
                if(drops.food) food += drops.food;
                if(drops.coal) coal += drops.coal;
                if(drops.copper) copper += drops.copper;
                if(drops.iron) iron += drops.iron;
                if(drops.random){
                    let r = Math.random();
                    if(r<0.3) { arrows+=12; showFloatingText("🏹 +12 стрел", bx, by, "#aaffaa"); }
                    else if(r<0.5) { food+=8; showFloatingText("🍎 +8 еды", bx, by, "#aaffaa"); }
                    else if(r<0.7 && toolTier<4) { }
                    else { coal+=5; showFloatingText("🔥 +5 угля", bx, by, "#aaffaa"); }
                }
            }
            if(stats.respawnDelay) scheduleRespawn(bx, by, stats.respawnType);
            else worldMap[by][bx] = { type: 0, health: 0, maxHealth: 0, respawnTimer: null };
            updateUI();
            showFloatingText("✓ Сломано", bx, by, "#aaffaa");
        } else {
            showFloatingText(`💥 ${damage} | ост: ${block.health}`, bx, by, "#ffaa66");
        }
        drawGame();
    }

    function rangedAttack(targetX, targetY){
        if(!gameActive) return;
        if(currentWeaponMode === "melee") { showFloatingText("Смени оружие на лук/арбалет", player.x, player.y, "#ff8888"); return; }
        if(arrows <= 0) { showFloatingText("Нет стрел!", player.x, player.y, "#ff8888"); return; }
        let targetZombie = null;
        for(let z of zombies){
            if(z.x === targetX && z.y === targetY){
                targetZombie = z;
                break;
            }
        }
        if(!targetZombie) return;
        let damage = (currentWeaponMode === "bow") ? 8 : 12;
        arrows--;
        targetZombie.health -= damage;
        showFloatingText(`🏹 ${damage}`, targetZombie.x, targetZombie.y, "#ffaa66");
        if(targetZombie.health <= 0){
            zombies = zombies.filter(z=>z!==targetZombie);
            showFloatingText("☠️ Зомби убит", targetZombie.x, targetZombie.y, "#aaffaa");
        }
        updateUI();
        drawGame();
    }

    function smeltInFurnace(){
        if(!gameActive) return;
        if(coal>0){
            if(copper>=2){ copper-=2; iron+=1; showFloatingText("⚙️ Железо выплавлено", player.x, player.y, "#ccccaa"); coal--; updateUI(); drawGame(); return; }
            if(copper>=1){ copper--; showFloatingText("🟤 Медь переплавлена", player.x, player.y, "#ccccaa"); coal--; updateUI(); drawGame(); return; }
            showFloatingText("Нет руды", player.x, player.y, "#ffaaaa");
        } else {
            showFloatingText("Нет угля!", player.x, player.y, "#ffaaaa");
        }
    }

    function craft(recipe){
        if(!gameActive) return;
        let ok = true;
        for(let [mat,amt] of Object.entries(recipe.need)){
            if(mat==='stone' && stone<amt) ok=false;
            if(mat==='wood' && wood<amt) ok=false;
            if(mat==='iron' && iron<amt) ok=false;
            if(mat==='copper' && copper<amt) ok=false;
            if(mat==='food' && food<amt) ok=false;
        }
        if(!ok) { showFloatingText("❌ Не хватает", player.x, player.y, "#ff8888"); return; }
        for(let [mat,amt] of Object.entries(recipe.need)){
            if(mat==='stone') stone-=amt;
            if(mat==='wood') wood-=amt;
            if(mat==='iron') iron-=amt;
            if(mat==='copper') copper-=amt;
            if(mat==='food') food-=amt;
        }
        if(recipe.result.toolId){ unlockTool(recipe.result.toolId); showFloatingText(`✨ Выкрафчена ${getToolById(recipe.result.toolId).name}`, player.x, player.y, "#aaffaa"); }
        if(recipe.result.weaponId){ unlockWeapon(recipe.result.weaponId); showFloatingText(`✨ Выкрафчен ${getWeaponById(recipe.result.weaponId).name}`, player.x, player.y, "#aaffaa"); }
        if(recipe.result.extraArrows){ arrows += recipe.result.extraArrows; showFloatingText(`🏹 +${recipe.result.extraArrows} стрел`, player.x, player.y, "#aaffaa"); }
        if(recipe.result.hungerHeal){ player.hunger = Math.min(player.maxHunger, player.hunger+recipe.result.hungerHeal); showFloatingText("🍞 Голод восст.", player.x, player.y, "#aaffaa"); }
        updateUI(); drawGame();
        renderInventoryUI();
    }

    // Зомби сгорают на рассвете
    function burnZombiesAtSunrise() {
        if(dayTime === 0 && cycleSeconds < 3) { // первые 3 секунды дня
            let burned = false;
            for(let i=0; i<zombies.length; i++){
                zombies[i].health -= 5;
                if(zombies[i].health <= 0){
                    zombies.splice(i,1);
                    i--;
                    burned = true;
                }
            }
            if(burned) showFloatingText("🔥 Зомби сгорают на солнце!", player.x, player.y, "#ffaa66");
        }
    }

    function spawnZombiesForNight() {
        let count = 2 + Math.floor(nightCount / 2);
        if(count > 8) count = 8;
        for(let i=0; i<count; i++){
            let x = Math.min(MAP_WIDTH-1, Math.max(0, player.x + (Math.random() > 0.5 ? 3 + Math.random()*3 : -3 - Math.random()*3)));
            let y = Math.min(MAP_HEIGHT-1, Math.max(0, player.y + (Math.random() > 0.5 ? 2 + Math.random()*3 : -2 - Math.random()*3)));
            zombies.push({ x: Math.floor(x), y: Math.floor(y), health: 20, damage: 4 });
        }
    }

    function updateGameLoop(){
        if(!gameActive) return;
        let now = Date.now();
        if(now - lastTick >= 1000){
            lastTick = now;
            let wasNight = (dayTime === 1);
            cycleSeconds++;
            if(cycleSeconds >= 45){
                cycleSeconds = 0;
                dayTime = 1 - dayTime;
                if(dayTime === 0){
                    survivedNights++;
                    updateUI();
                }
                if(dayTime === 1){
                    nightCount++;
                    spawnZombiesForNight();
                }
                updateUI();
            }
            // Зомби сгорают на рассвете
            if(wasNight && dayTime === 0) {
                burnZombiesAtSunrise();
            }
            
            if(!bonusChest.active){
                bonusChest.spawnTimer -= 1;
                if(bonusChest.spawnTimer <= 0){
                    spawnBonusChest();
                }
                updateUI();
            }
            if(dayTime===0 && Math.random()<0.4 && player.hunger>0) player.hunger = Math.max(0, player.hunger-1);
            if(player.hunger<=0){ player.health = Math.max(0, player.health-2); showFloatingText("💀 Голод!", player.x, player.y, "#ff5555"); }
            for(let i=0;i<zombies.length;i++){
                let z=zombies[i];
                let dx = Math.sign(player.x - z.x);
                let dy = Math.sign(player.y - z.y);
                if(Math.abs(player.x-z.x)<=1 && Math.abs(player.y-z.y)<=1){
                    player.health = Math.max(0, player.health - z.damage);
                    showFloatingText(`💔 -${z.damage}`, player.x, player.y, "#ff8888");
                    if(player.health <= 0){
                        gameActive = false;
                        showDeathScreen();
                        return;
                    }
                } else {
                    z.x = Math.min(MAP_WIDTH-1, Math.max(0, z.x+dx));
                    z.y = Math.min(MAP_HEIGHT-1, Math.max(0, z.y+dy));
                }
            }
            updateUI();
            drawGame();
        }
        drawGame();
    }

    function showDeathScreen(){
        const div = document.createElement('div');
        div.className = 'death-overlay';
        div.innerHTML = `<div class="death-card">
            <div>💀 ВЫ ПОГИБЛИ 💀</div>
            <div style="margin-top:15px;">📆 Выжито дней: ${survivedNights}</div>
            <div style="margin-top:10px; font-size:0.8rem;">Ночной зомби-апокалипсис...</div>
            <button id="restartBtn">Играть снова</button>
        </div>`;
        document.body.appendChild(div);
        document.getElementById('restartBtn').onclick = () => { location.reload(); };
    }

    function renderInventoryUI() {
        const slotsContainer = document.getElementById('inventorySlots');
        if(!slotsContainer) return;
        slotsContainer.innerHTML = '';
        
        availableTools.forEach(tool => {
            if(tool.crafted) {
                const slot = document.createElement('div');
                slot.className = 'inv-slot';
                if(equippedToolId === tool.id) slot.classList.add('equipped');
                slot.innerHTML = `<div class="inv-slot-icon">${tool.icon}</div><div class="inv-slot-name">${tool.name}</div><div class="inv-slot-damage">${tool.damage} урона</div>`;
                slot.onclick = () => equipTool(tool.id);
                slotsContainer.appendChild(slot);
            }
        });
        availableWeapons.forEach(weapon => {
            if(weapon.crafted) {
                const slot = document.createElement('div');
                slot.className = 'inv-slot';
                if(equippedWeaponId === weapon.id) slot.classList.add('equipped');
                slot.innerHTML = `<div class="inv-slot-icon">${weapon.icon}</div><div class="inv-slot-name">${weapon.name}</div><div class="inv-slot-damage">${weapon.damage} урона</div>`;
                slot.onclick = () => equipWeapon(weapon.id);
                slotsContainer.appendChild(slot);
            }
        });
        document.getElementById('equippedTool').innerHTML = getToolById(equippedToolId)?.name || "Деревянная";
        let wep = getWeaponById(equippedWeaponId);
        document.getElementById('equippedWeapon').innerHTML = wep ? `${wep.name} (${wep.damage} урона)` : "Кирка (3 урона)";
    }

    function openInventory() { renderInventoryUI(); document.getElementById('inventoryModal').style.display = 'flex'; }
    function closeInventory() { document.getElementById('inventoryModal').style.display = 'none'; }

    function drawGame(){
        ctx.clearRect(0,0,canvas.width,canvas.height);
        for(let row=0;row<MAP_HEIGHT;row++){
            for(let col=0;col<MAP_WIDTH;col++){
                let b=worldMap[row][col];
                let x=col*TILE_SIZE, y=row*TILE_SIZE;
                if(b.type===0){
                    ctx.fillStyle='#5f7e4a'; ctx.fillRect(x,y,TILE_SIZE-1,TILE_SIZE-1);
                    ctx.fillStyle='#6f9e55'; ctx.fillRect(x+2,y+2,TILE_SIZE-5,TILE_SIZE-5);
                } else if(b.type===1){
                    ctx.fillStyle='#5c3e1f'; ctx.fillRect(x,y,TILE_SIZE-1,TILE_SIZE-1);
                    ctx.fillStyle='#7c5e2b'; ctx.fillRect(x+8,y+10,34,40);
                    ctx.fillStyle='#296d29'; ctx.fillRect(x+18,y-4,14,18);
                } else if(b.type===2){
                    ctx.fillStyle='#6b6b6b'; ctx.fillRect(x,y,TILE_SIZE-1,TILE_SIZE-1);
                    ctx.fillStyle='#8f8f8f'; ctx.fillRect(x+6,y+10,38,32);
                } else if(b.type===3){
                    ctx.fillStyle='#b3470c'; ctx.fillRect(x,y,TILE_SIZE-1,TILE_SIZE-1);
                    ctx.fillStyle='#e05e1e'; ctx.beginPath(); ctx.arc(x+25,y+30,12,0,Math.PI*2); ctx.fill();
                    ctx.fillStyle='#ffbb77'; ctx.fillText('🍓',x+18,y+35);
                } else if(b.type===4){
                    ctx.fillStyle='#8b5a2b'; ctx.fillRect(x,y,TILE_SIZE-1,TILE_SIZE-1);
                    ctx.fillStyle='#d4a373'; ctx.fillRect(x+8,y+10,34,26);
                    ctx.fillStyle='#f7d44a'; ctx.fillText('✨',x+22,y+32);
                } else if(b.type===5){
                    ctx.fillStyle='#3a3a3a'; ctx.fillRect(x,y,TILE_SIZE-1,TILE_SIZE-1);
                    ctx.fillStyle='#1a1a1a'; ctx.fillRect(x+10,y+12,30,30);
                } else if(b.type===6){
                    ctx.fillStyle='#b87333'; ctx.fillRect(x,y,TILE_SIZE-1,TILE_SIZE-1);
                    ctx.fillStyle='#cd7f45'; ctx.fillRect(x+12,y+10,26,28);
                } else if(b.type===7){
                    ctx.fillStyle='#8c8c8c'; ctx.fillRect(x,y,TILE_SIZE-1,TILE_SIZE-1);
                    ctx.fillStyle='#b0b0b0'; ctx.fillRect(x+10,y+10,30,30);
                }
                if(b.health && b.health<b.maxHealth){
                    ctx.fillStyle="#ffaa44aa"; ctx.fillRect(x+5,y+2, Math.max(2, (b.health/b.maxHealth)*40),4);
                }
            }
        }
        if(bonusChest.active){
            let x=bonusChest.x*TILE_SIZE, y=bonusChest.y*TILE_SIZE;
            ctx.fillStyle='#d4af37'; ctx.fillRect(x+8,y+10,34,26);
            ctx.fillStyle='#ffd966'; ctx.fillText('🎁', x+22, y+32);
        }
        let px=player.x*TILE_SIZE, py=player.y*TILE_SIZE;
        ctx.fillStyle="#4c7a4a"; ctx.fillRect(px+12,py+20,26,18);
        ctx.fillStyle="#3b2f2a"; ctx.fillRect(px+12,py+32,26,6);
        ctx.fillStyle="#e0aa7a"; ctx.fillRect(px+14,py+6,22,18);
        ctx.fillStyle="#2e241f"; ctx.fillRect(px+20,py+10,4,4); ctx.fillRect(px+26,py+10,4,4);
        ctx.fillStyle="#1f1408"; ctx.fillRect(px+14,py+6,22,5);
        let tool = getToolById(equippedToolId);
        ctx.fillStyle=tool?.tier===1?"#b57a3b":(tool?.tier===2?"#7e8c8d":(tool?.tier===3?"#d98c45":"#dcdcdc"));
        ctx.fillRect(px+40,py+30,14,5); ctx.fillRect(px+48,py+24,5,14);
        zombies.forEach(z=>{
            let zx=z.x*TILE_SIZE, zy=z.y*TILE_SIZE;
            ctx.fillStyle="#2f6b3a"; ctx.fillRect(zx+10,zy+14,30,30);
            ctx.fillStyle="#1f3a1a"; ctx.fillRect(zx+18,zy+8,14,12);
            ctx.fillStyle="#000"; ctx.fillRect(zx+20,zy+22,4,4); ctx.fillRect(zx+26,zy+22,4,4);
            ctx.fillStyle="#aa0000"; ctx.fillRect(zx+5,zy+2, (z.health/20)*40,5);
        });
        floatingMessages = floatingMessages.filter(m=>{ m.life-=0.03; m.y-=1; return m.life>0; });
        floatingMessages.forEach(m=>{ ctx.font="bold 14px monospace"; ctx.fillStyle=m.color; ctx.fillText(m.text, m.x-20, m.y-12); });
        if(dayTime===1){
            ctx.fillStyle = "rgba(0,0,40,0.65)";
            ctx.fillRect(0,0,canvas.width,canvas.height);
        }
    }

    // Движение
    let moveDir={x:0,y:0}, lastMove=0;
    function tryMove(dx,dy){
        if(!gameActive) return false;
        let nx=player.x+dx, ny=player.y+dy;
        if(nx>=0 && nx<MAP_WIDTH && ny>=0 && ny<MAP_HEIGHT){
            player.x=nx; player.y=ny;
            drawGame();
            return true;
        }
        return false;
    }
    function updateMovement(){
        if(!gameActive) return;
        if(moveDir.x===0 && moveDir.y===0) return;
        let now=Date.now();
        if(now-lastMove>=150){
            let dx=Math.abs(moveDir.x)>0.3?(moveDir.x>0?1:-1):0;
            let dy=Math.abs(moveDir.y)>0.3?(moveDir.y>0?1:-1):0;
            if(dx!==0||dy!==0) tryMove(dx,dy);
            lastMove=now;
        }
        requestAnimationFrame(updateMovement);
    }

    // Джойстик
    let joystickActive=false, joystickBase=null, joystickThumb=null, baseRect={}, maxDist=50;
    function createJoystick(cx,cy){
        if(joystickBase) joystickBase.remove();
        let cont=document.createElement('div'); cont.id='joyCont'; document.body.appendChild(cont);
        joystickBase=document.createElement('div'); joystickBase.className='joystick-base';
        joystickThumb=document.createElement('div'); joystickThumb.className='joystick-thumb';
        joystickBase.appendChild(joystickThumb); cont.appendChild(joystickBase);
        let x=Math.min(window.innerWidth-140, Math.max(0,cx-70));
        let y=Math.min(window.innerHeight-140, Math.max(0,cy-70));
        joystickBase.style.left=x+'px'; joystickBase.style.top=y+'px';
        let rect=joystickBase.getBoundingClientRect();
        baseRect={cx:rect.left+rect.width/2, cy:rect.top+rect.height/2};
        maxDist=rect.width/2-15;
        moveDir={x:0,y:0};
    }
    function moveJoystick(cx,cy){
        if(!joystickActive) return;
        let dx=cx-baseRect.cx, dy=cy-baseRect.cy;
        let dist=Math.min(Math.hypot(dx,dy), maxDist);
        let ang=Math.atan2(dy,dx);
        joystickThumb.style.left=(50+(Math.cos(ang)*(dist/maxDist)*50))+'%';
        joystickThumb.style.top=(50+(Math.sin(ang)*(dist/maxDist)*50))+'%';
        moveDir.x=Math.cos(ang)*(dist/maxDist);
        moveDir.y=Math.sin(ang)*(dist/maxDist);
        if(dist<8) moveDir={x:0,y:0};
    }
    function releaseJoy(){ joystickActive=false; if(joystickBase) joystickBase.remove(); joystickBase=null; moveDir={x:0,y:0}; }
    canvas.addEventListener('touchstart',(e)=>{ e.preventDefault(); let t=e.touches[0]; createJoystick(t.clientX,t.clientY); joystickActive=true; moveJoystick(t.clientX,t.clientY); });
    canvas.addEventListener('touchmove',(e)=>{ if(joystickActive){ e.preventDefault(); moveJoystick(e.touches[0].clientX,e.touches[0].clientY); } });
    canvas.addEventListener('touchend',()=>releaseJoy());
    
    canvas.addEventListener('click',(e)=>{
        if(!gameActive) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let mouseX = (e.clientX - rect.left) * scaleX;
        let mouseY = (e.clientY - rect.top) * scaleY;
        let tileX = Math.floor(mouseX / TILE_SIZE);
        let tileY = Math.floor(mouseY / TILE_SIZE);
        if(tileX>=0 && tileX<MAP_WIDTH && tileY>=0 && tileY<MAP_HEIGHT){
            for(let z of zombies){
                if(z.x===tileX && z.y===tileY){
                    rangedAttack(tileX, tileY);
                    return;
                }
            }
        }
    });
    
    let keys={};
    window.addEventListener('keydown',(e)=>{
        if(!gameActive) return;
        let k=e.key;
        if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','W','s','S','a','A','d','D'].includes(k)){
            e.preventDefault();
            keys[k.toLowerCase()] = true;
            updateKeys();
        }
        if(k===' '||k==='e'||k==='E'){
            e.preventDefault();
            performAction();
        }
        if(k==='i'||k==='I'){
            e.preventDefault();
            openInventory();
        }
    });
    window.addEventListener('keyup',(e)=>{ delete keys[e.key.toLowerCase()]; updateKeys(); });
    function updateKeys(){
        let dx=0,dy=0;
        if(keys['arrowup']||keys['w']) dy=-1;
        if(keys['arrowdown']||keys['s']) dy=1;
        if(keys['arrowleft']||keys['a']) dx=-1;
        if(keys['arrowright']||keys['d']) dx=1;
        if(dx!==0||dy!==0){
            let now=Date.now();
            if(now-lastMove>=150){ tryMove(dx,dy); lastMove=now; }
        }
    }

    function renderCrafting(){
        let grid=document.getElementById('craftGrid');
        grid.innerHTML='';
        recipes.forEach(rec=>{
            let btn=document.createElement('button');
            btn.innerText=rec.name;
            btn.className='craft-btn';
            btn.onclick=()=>craft(rec);
            grid.appendChild(btn);
        });
    }
    
    document.getElementById('actionBtn').onclick=()=>performAction();
    document.getElementById('furnaceBtn').onclick=()=>smeltInFurnace();
    document.getElementById('inventoryBtn').onclick=()=>openInventory();
    document.getElementById('inventoryToggleBtn')?.addEventListener('click',()=>openInventory());
    document.getElementById('closeInventoryBtn').onclick=()=>closeInventory();
    window.onclick = (e) => { let modal = document.getElementById('inventoryModal'); if(e.target === modal) closeInventory(); };
    
    generateWorld();
    renderCrafting();
    updateEquippedStats();
    updateUI();
    drawGame();
    setInterval(()=>updateGameLoop(), 50);
    updateMovement();
})();