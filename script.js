// ========== KHAI BÁO BIẾN ==========
      const canvas = document.getElementById("gameCanvas");
      const ctx = canvas.getContext("2d");
      const videoPlayer = document.getElementById("videoPlayer");
      const skipVideoBtn = document.getElementById("skipVideoBtn");
      const dpr = window.devicePixelRatio || 1;
      // Kích thước canvas
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
      // ========== LOAD HÌNH ẢNH ==========
      const images = {};
      const imageSources = {
        player: "./assets/UFO.png",
        bullet: "./assets/bullet.png",
        bulletSpecial: "./assets/bullet_special.png",
        enemyMinion: "./assets/nom.png",
        enemyBanana: "./assets/big nom.png",
        explosion: "./assets/explosion.png",
        boss: "./assets/bossship.png",
      };

      function loadImages(callback) {
        let loaded = 0;
        const keys = Object.keys(imageSources);
        const total = keys.length;
        keys.forEach((key) => {
          const img = new Image();
          img.src = imageSources[key];
          img.onload = () => {
            images[key] = img;
            loaded++;
            if (loaded === total && callback) callback();
          };
          img.onerror = () => {
            console.warn(imageSources[key]);
            loaded++;
            if (loaded === total && callback) callback();
          };
        });
      }

      // Game state
      const gameState = {
        running: false,
        keys: {},
        player: {
          x: 100,
          y: canvas.height / 2,
          width: 80,
          height: 50,
          speed: 8,
          velocityX: 0,
          velocityY: 0,
          health: 100,
          maxHealth: 100,
          shield: false,
          shieldTime: 0,
          lastShot: 0,
          shootDelay: 150,
          invulnerable: 0,
        },
        enemies: [],
        projectiles: [],
        enemyProjectiles: [],
        particles: [],
        stars: [],
        score: 0,
        combo: 0,
        comboTimeout: null,
        lastComboTime: 0,
        victoryPoints: 200,
        level: 1,
        lastTime: 0,
        deltaTime: 0,
        enemySpawnRate: 2000,
        lastEnemySpawn: 0,
      };

      // ==== ENEMY BULLET CONFIG (chỉnh ở đây là đủ) ====
      window.ENEMY_BULLET = {
        nom: {
          // lính nhỏ (type hiện tại: "minion")
          speed: 10, // px / frame (được nhân với deltaTime/16 khi cập nhật)
          size: { w: 100, h: 80 },
          damage: [4, 7], // min..max
          cooldown: 900, // ms giữa 2 lần bắn của 1 con
          pattern: "straight", // "straight" | "aimed" | "spread3"
          spreadAngle: 0.22, // dùng khi pattern=spread3 (radian)
          jitter: 0.0, // sai số góc ngắm nếu aimed
          color: "#ff4d4d", // nếu không có sprite, vẽ rect màu
          sprite: "./assets/huhu.png", // có thể đặt "./assets/enemy_bullet_nom.png"
        },
        bigNom: {
          // lính to (type hiện tại: "banana")
          speed: 9,
          size: { w: 100, h: 80 },
          damage: [8, 12],
          cooldown: 700,
          pattern: "spread3",
          spreadAngle: 0.25,
          jitter: 0.0,
          color: "#ffa000",
          sprite: "./assets/meow.png", // ví dụ "./assets/enemy_bullet_bignom.png"
        },
        boss: {
          // boss (khi bạn thêm/đang có boss)
          speed: 8,
          size: { w: 100, h: 80 },
          damage: [12, 18],
          cooldown: 450,
          pattern: "aimed",
          spreadAngle: 0.2, // có thể dùng spread3 cho boss nếu thích
          jitter: 0.18,
          color: "#ff00ff",
          sprite: "./assets/solar_flares.png", // ví dụ "./assets/enemy_bullet_boss.png"
        },
      };

      // ánh xạ tên type trong game -> key config
      const TYPE_ALIAS = { minion: "nom", banana: "bigNom", boss: "boss" };

      // tiện ích random số nguyên trong đoạn [a,b]
      const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

      // ========== HÀM KHỞI TẠO ==========
      function initGame() {
        // Tạo ngôi sao nền
        gameState.stars = [];
        for (let i = 0; i < 150; i++) {
          gameState.stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 1,
            speed: Math.random() * 0.5 + 0.1,
            brightness: Math.random() * 0.5 + 0.5,
          });
        }
      }

      let currentVideoType = null;
      async function playVideo1() {
        document.getElementById("startScreen").style.display = "none";
        document.getElementById("videoScreen").style.display = "flex";
        currentVideoType = "intro";
        const src = AssetManager.pickVideoSrc("intro") || "./assets/intro.mp4";

        showLoader("Loading intro…");
        try {
          // dùng cache nếu có, ngược lại đợi preload nhanh
          if (!AssetManager.videoCache.has("intro")) {
            await AssetManager.preloadVideo(src, {
              timeout: 8000,
              muted: true,
            });
          }
          hideLoader();
        } catch (e) {
          console.warn(e);
          hideLoader();
        }

        videoPlayer.src = src;
        videoPlayer.muted = true; // giúp autoplay ổn định
        videoPlayer.removeAttribute("controls");
        videoPlayer.setAttribute("playsinline", "");
        videoPlayer.play().catch(() => showPlayButton());
        skipVideoBtn.style.display = "none";
        setTimeout(() => {
          skipVideoBtn.style.display = "block";
        }, 3000);
        videoPlayer.onended = () => {
          showStartMenu();
        };
        videoPlayer.oncontextmenu = (e) => {
          e.preventDefault();
          return false;
        };
      }

      async function playVideo2() {
        // Ending
        document.getElementById("victoryScreen").style.display = "none";
        document.getElementById("videoScreen").style.display = "flex";
        currentVideoType = "victory";
        const src =
          AssetManager.pickVideoSrc("ending") || "./assets/ending.mp4";

        showLoader("Loading ending…");
        try {
          if (!AssetManager.videoCache.has("ending")) {
            await AssetManager.preloadVideo(src, {
              timeout: 9000,
              muted: true,
            });
          }
          hideLoader();
        } catch (e) {
          console.warn(e);
          hideLoader();
        }

        videoPlayer.src = src;
        videoPlayer.muted = true;
        videoPlayer.removeAttribute("controls");
        videoPlayer.setAttribute("playsinline", "");
        videoPlayer.play().catch(() => showPlayButton());
        skipVideoBtn.style.display = "none";
        setTimeout(() => {
          skipVideoBtn.style.display = "block";
        }, 3000);
        videoPlayer.oncontextmenu = (e) => {
          e.preventDefault();
          return false;
        };
      }

      function playCutscene() {
        // document.getElementById("startMenu").style.display = "none";
        // document.getElementById("videoScreen").style.display = "flex";
        // videoPlayer.src = "./assets/cutscene.mp4";
        // currentVideoType = "cutscene";
        // videoPlayer.controls = false;
        // videoPlayer.removeAttribute("controls");
        // videoPlayer.play().catch(() => showPlayButton());
        // skipVideoBtn.style.display = "none";
        // setTimeout(() => {
        //   skipVideoBtn.style.display = "block";
        // }, 3000);
        // videoPlayer.onended = function () {
        //   showMainMenu();
        // };
        // videoPlayer.oncontextmenu = function (e) {
        //   e.preventDefault();
        //   return false;
        // };
        // Ẩn tất cả màn có thể đang mở
        const hide = (id) => {
          const el = document.getElementById(id);
          if (el) el.style.display = "none";
        };
        hide("videoScreen");
        hide("startScreen");
        hide("startMenu");
        hide("mainGame");

        // Hiện màn chuẩn bị chiến đấu
        const bs = document.getElementById("Cutscene1");
        if (bs) bs.style.display = "flex";
      }

      function finishCutscene() {
        const cut = document.getElementById("Cutscene1");
        const ctr = document.getElementById("cutsceneControls");
        if (cut) cut.style.display = "none";
        if (ctr) {
          ctr.style.display = "none";
          ctr.style.pointerEvents = "none";
        }

        showMainMenu();
      }

      let cutsceneUnlocked = false;

      function enableContinueAfter(ms) {
        cutsceneUnlocked = false;
        const tip = document.getElementById("tapAnywhere");
        const overlay = document.getElementById("cutsceneControls");
        if (tip) tip.textContent = "Please wait…";
        if (overlay) overlay.style.pointerEvents = "none"; // KHÔNG chặn click lên Canva

        setTimeout(() => {
          cutsceneUnlocked = true;
          if (tip) tip.textContent = "Click anywhere to continue";
          if (overlay) overlay.style.pointerEvents = "auto"; // TỪ LÚC NÀY mới bắt click
        }, ms);
      }

      // Bắt click toàn màn để kết thúc — chỉ chạy khi đã unlock
      document
        .getElementById("cutsceneControls")
        ?.addEventListener("click", () => {
          const open = document.getElementById("Cutscene1");
          if (!open || open.style.display === "none") return;
          if (!cutsceneUnlocked) return; // chưa unlock thì bỏ qua
          finishCutscene();
        });

      // Skip luôn hoạt động
      document
        .getElementById("cutsceneSkip")
        ?.addEventListener("click", finishCutscene);

      // Mở cutscene: hiện Canva + overlay chữ, nhưng KHÔNG chặn click cho tới khi unlock
      playCutscene = function () {
        ["videoScreen", "startScreen", "startMenu", "mainGame"].forEach(
          (id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = "none";
          }
        );
        const bs = document.getElementById("Cutscene1");
        const ctr = document.getElementById("cutsceneControls");
        if (bs) {
          bs.style.display = "block";
          bs.style.zIndex = 110;
        }
        if (ctr) {
          ctr.style.display = "block";
          ctr.style.pointerEvents = "none";
        }

        enableContinueAfter(12000); // ~3 slide ≈ 12s, chỉnh tuỳ bạn
      };

      // Cho phép bấm Space/Enter để tiếp tục
      document.addEventListener("keydown", (e) => {
        const open = document.getElementById("Cutscene1");
        if (!open || open.style.display === "none") return;
        if (e.key === "Enter") {
          e.preventDefault();
          finishCutscene();
        }
      });

      // Khi mở cutscene, hiện overlay + (tuỳ chọn) khoá nút Continue  X giây
      const _playCutscene = playCutscene;
      playCutscene = function () {
        // Ẩn các màn khác như bạn đã làm
        const hide = (id) => {
          const el = document.getElementById(id);
          if (el) el.style.display = "none";
        };
        hide("videoScreen");
        hide("startScreen");
        hide("startMenu");
        hide("mainGame");

        // Hiện Canva + overlay
        const bs = document.getElementById("Cutscene1");
        if (bs) {
          bs.style.display = "block";
          bs.style.zIndex = 110;
        } // block là đủ
        const ctr = document.getElementById("cutsceneControls");
        if (ctr) ctr.style.display = "block";

        // Nếu bạn muốn ước lượng "3 slide ~ 12 giây", mở khoá sau 12s:
        enableContinueAfter(12000);

        // Bạn cũng có thể chờ iframe load để ẩn loader (nếu có)
        const iframe = document.querySelector("#Cutscene1 iframe");
        iframe?.addEventListener("load", () => {
          /* hideLoader() nếu bạn dùng loader */
        });
      };

      async function playCredits() {
        document.getElementById("videoScreen").style.display = "flex";
        currentVideoType = "credits";
        const src =
          AssetManager.pickVideoSrc("credits") || "./assets/credits.mp4";

        showLoader("Loading credits…");
        try {
          if (!AssetManager.videoCache.has("credits")) {
            await AssetManager.preloadVideo(src, {
              timeout: 10000,
              muted: true,
            });
          }
          hideLoader();
        } catch (e) {
          console.warn(e);
          hideLoader();
        }

        videoPlayer.src = src;
        videoPlayer.muted = true; // autoplay-friendly
        videoPlayer.removeAttribute("controls");
        videoPlayer.setAttribute("playsinline", "");
        // Chờ ít nhất loadeddata trước khi ẩn loader nếu có reload đột xuất
        const once = () => {
          hideLoader();
          videoPlayer.onloadeddata = null;
        };
        videoPlayer.onloadeddata = once;
        videoPlayer.play().catch(() => showPlayButton());
        skipVideoBtn.style.display = "none";
        setTimeout(() => {
          skipVideoBtn.style.display = "block";
        }, 3000);
        videoPlayer.onended = () => {
          returnToStart();
        };
        videoPlayer.oncontextmenu = (e) => {
          e.preventDefault();
          return false;
        };
      }

      // Hàm hiển thị nút play nếu autoplay bị chặn
      function showPlayButton() {
        const playBtn = document.createElement("button");
        playBtn.textContent = "Start video";
        Object.assign(playBtn.style, {
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          padding: "15px 30px",
          fontSize: "1.5rem",
          background: "linear-gradient(135deg, #ff69b4, #ff1493)",
          color: "white",
          border: "none",
          borderRadius: "25px",
          cursor: "pointer",
          zIndex: 97,
        });
        playBtn.onclick = function () {
          videoPlayer.play();
          playBtn.remove();
        };
        document.getElementById("videoScreen").appendChild(playBtn);
      }

      function skipVideo() {
        videoPlayer.pause();
        videoPlayer.currentTime = 0;
        if (currentVideoType === "intro") showStartMenu();
        else if (currentVideoType === "victory") returnToStart();
        else if (currentVideoType === "cutscene") showMainMenu();
        currentVideoType = null;
      }

      function char1stats() {
        document.getElementById("tall_stats").hidden = false;
        document.getElementById("hard_stats").hidden = true;
      }
      function char2stats() {
        document.getElementById("hard_stats").hidden = false;
        document.getElementById("tall_stats").hidden = true;
      }

      function showMainMenu() {
        // Ẩn mọi màn có thể còn mở
        [
          "videoScreen",
          "startScreen",
          "startMenu",
          "characterScreen",
          "battleStartScreen",
          "gameOver",
          "victoryScreen",
        ].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.style.display = "none";
        });

        // Hiện Main Game
        const mg = document.getElementById("mainGame");
        if (mg) mg.style.display = "flex";
      }

      function showStartMenu() {
        document.getElementById("videoScreen").style.display = "none";
        document.getElementById("startMenu").style.display = "flex";
      }

      function showCharacterMenu() {
        document.getElementById("mainGame").style.display = "none";
        document.getElementById("characterScreen").style.display = "flex";
      }

      function showBattleStartScreen() {
        // Ẩn mọi màn có thể mở + Canva + overlay
        [
          "videoScreen",
          "startScreen",
          "startMenu",
          "mainGame",
          "Cutscene1",
          "cutsceneControls",
        ].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.style.display = "none";
        });

        // Hiện màn chuẩn bị chiến đấu
        const bs = document.getElementById("battleStartScreen");
        if (bs) bs.style.display = "flex";
      }

      function startBattle() {
        // Ẩn hết các màn khác để khỏi đè
        [
          "battleStartScreen",
          "startMenu",
          "mainGame",
          "videoScreen",
          "startScreen",
        ].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.style.display = "none";
        });

        document.getElementById("gameScene").style.display = "block";
        loadImages(() => {
          initGame();
          gameState.running = true;
          window.addEventListener("keydown", handleKeyDown);
          window.addEventListener("keyup", handleKeyUp);
          canvas.addEventListener("touchstart", handleTouchStart);
          canvas.addEventListener("touchmove", handleTouchMove);
          canvas.addEventListener("touchend", handleTouchEnd);
          requestAnimationFrame(gameLoop);
        });
      }

      function returnToStart() {
        gameState.running = false;
        gameState.player.health = 100;
        gameState.player.x = 100;
        gameState.player.y = canvas.height / 2;
        gameState.player.velocityX = 0;
        gameState.player.velocityY = 0;
        gameState.enemies = [];
        gameState.projectiles = [];
        gameState.enemyProjectiles = [];
        gameState.particles = [];
        gameState.score = 0;
        gameState.combo = 0;
        gameState.level = 1;
        gameState.enemySpawnRate = 2000;
        gameState.lastEnemySpawn = 0;

        document.getElementById("videoScreen").style.display = "none";
        document.getElementById("startScreen").style.display = "flex";
        updateUI();
      }

      function restartGame() {
        document.getElementById("gameOver").style.display = "none";
        document.getElementById("gameScene").style.display = "block";
        gameState.running = true;
        gameState.player.health = 100;
        gameState.player.x = 100;
        gameState.player.y = canvas.height / 2;
        gameState.player.velocityX = 0;
        gameState.player.velocityY = 0;
        gameState.enemies = [];
        gameState.projectiles = [];
        gameState.enemyProjectiles = [];
        gameState.particles = [];
        gameState.score = 0;
        gameState.combo = 0;
        gameState.level = 1;
        gameState.enemySpawnRate = 2000;
        updateUI();
        requestAnimationFrame(gameLoop);
      }

      function char1stats() {
        // Tall
        document.getElementById("tall_stats").hidden = false;
        document.getElementById("hard_stats").hidden = true;
        document.getElementById("charName").textContent = "Vanilla";
      }
      function char2stats() {
        // Hard
        document.getElementById("hard_stats").hidden = false;
        document.getElementById("tall_stats").hidden = true;
        document.getElementById("charName").textContent = "Chocolate"; // đổi tên tùy bạn
      }

      // Gắn vào click của 2 nút 2 bên
      document.getElementById("tall")?.addEventListener("click", char1stats);
      document.getElementById("hard")?.addEventListener("click", char2stats);

      // ========== INPUT HANDLING ==========
      function handleKeyDown(e) {
        gameState.keys[e.key] = true;
        if (e.key === " ") e.preventDefault();
        if (e.key === "r" || e.key === "R") {
          activateShield();
          document.getElementById("shieldBtn").classList.add("active");
        }
        if (e.key === "t" || e.key === "T") {
          specialAttack();
          document.getElementById("specialBtn").classList.add("active");
        }
      }
      function handleKeyUp(e) {
        gameState.keys[e.key] = false;
        if (e.key.toLowerCase() === "r")
          document.getElementById("shieldBtn").classList.remove("active");
        if (e.key.toLowerCase() === "t")
          document.getElementById("specialBtn").classList.remove("active");
      }
      function handleTouchStart(e) {
        e.preventDefault();
        const t = e.touches[0];
        gameState.touchX = t.clientX;
        gameState.touchY = t.clientY;
      }
      function handleTouchMove(e) {
        e.preventDefault();
        if (!gameState.touchX || !gameState.touchY) return;
        const t = e.touches[0];
        const dx = t.clientX - gameState.touchX;
        const dy = t.clientY - gameState.touchY;
        const p = gameState.player;
        p.x = Math.max(0, Math.min(canvas.width - p.width, p.x + dx));
        p.y = Math.max(0, Math.min(canvas.height - p.height, p.y + dy));
        gameState.touchX = t.clientX;
        gameState.touchY = t.clientY;
      }
      function handleTouchEnd() {
        gameState.touchX = null;
        gameState.touchY = null;
      }

      // ========== GAME LOOP ==========
      function updateProjectiles() {
        const dt = gameState.deltaTime / 16;

        // Player bullets
        for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
          const proj = gameState.projectiles[i];
          proj.x += proj.speed * dt;
          if (proj.x > canvas.width) {
            gameState.projectiles.splice(i, 1);
            continue;
          }
          const sprite =
            proj.type === "special" ? images.bulletSpecial : images.bullet;
          if (sprite && sprite.complete) {
            ctx.drawImage(sprite, proj.x, proj.y, proj.width, proj.height);
          } else {
            ctx.fillStyle = "#00ff00";
            ctx.fillRect(proj.x, proj.y, proj.width, proj.height);
          }
        }

        // Enemy bullets
        for (let i = gameState.enemyProjectiles.length - 1; i >= 0; i--) {
          const proj = gameState.enemyProjectiles[i];
          const dt16 = dt;
          proj.x += (proj.vx || -proj.speed || -8) * dt16;
          proj.y += (proj.vy || 0) * dt16;

          if (
            proj.x + proj.width < -40 ||
            proj.x > canvas.width + 40 ||
            proj.y + proj.height < -40 ||
            proj.y > canvas.height + 40
          ) {
            gameState.enemyProjectiles.splice(i, 1);
            continue;
          }

          if (proj.img instanceof Image && proj.img.complete) {
            ctx.drawImage(proj.img, proj.x, proj.y, proj.width, proj.height);
          } else {
            ctx.fillStyle = proj.color || "#ff0000";
            ctx.fillRect(proj.x, proj.y, proj.width, proj.height);
          }
        }
      }

      function gameLoop(timestamp) {
        gameState.deltaTime = timestamp - gameState.lastTime;
        gameState.lastTime = timestamp;
        ctx.fillStyle = "#0a0a1a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (gameState.running) {
          drawStars();
          handleContinuousInput();
          spawnEnemies();
          updatePlayer();
          updateEnemies();
          updateProjectiles();
          updateParticles();
          checkCollisions();
          checkVictory();
          updateUI();
          updateCombo();
        }
        requestAnimationFrame(gameLoop);
      }

      function handleContinuousInput() {
        const p = gameState.player;
        const speed = p.speed * (gameState.deltaTime / 16);
        p.velocityX = 0;
        p.velocityY = 0;
        if (gameState.keys["ArrowUp"] || gameState.keys["w"])
          p.velocityY = -speed;
        if (gameState.keys["ArrowDown"] || gameState.keys["s"])
          p.velocityY = speed;
        if (gameState.keys["ArrowLeft"] || gameState.keys["a"])
          p.velocityX = -speed;
        if (gameState.keys["ArrowRight"] || gameState.keys["d"])
          p.velocityX = speed;
        p.x = Math.max(0, Math.min(canvas.width - p.width, p.x + p.velocityX));
        p.y = Math.max(
          0,
          Math.min(canvas.height - p.height, p.y + p.velocityY)
        );
        if (
          (gameState.keys[" "] || gameState.keys["Spacebar"]) &&
          Date.now() - p.lastShot > p.shootDelay
        ) {
          playerAttack();
          p.lastShot = Date.now();
        }
        if (p.invulnerable > 0) p.invulnerable--;
      }

      // ========== VẼ ĐỐI TƯỢNG ==========
      function drawStars() {
        ctx.fillStyle = "white";
        gameState.stars.forEach((star) => {
          ctx.globalAlpha = star.brightness;
          ctx.fillRect(star.x, star.y, star.size, star.size);
          star.x -= star.speed;
          if (star.x < -star.size) {
            star.x = canvas.width;
            star.y = Math.random() * canvas.height;
          }
        });
        ctx.globalAlpha = 1;
      }

      function drawPlayer() {
        const p = gameState.player;
        if (images.player) {
          ctx.drawImage(images.player, p.x, p.y, p.width, p.height);
        } else {
          // fallback hình chữ nhật nếu ảnh chưa kịp load
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(p.x, p.y, p.width, p.height);
        }
        if (p.shield) {
          ctx.strokeStyle = "#00bfff";
          ctx.lineWidth = 3;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(p.x + p.width / 2, p.y + p.height / 2, 60, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      function drawEnemy(enemy) {
        if (enemy.type === "banana" && images.enemyBanana) {
          ctx.drawImage(
            images.enemyBanana,
            enemy.x,
            enemy.y,
            enemy.width,
            enemy.height
          );
        } else if (images.enemyMinion) {
          ctx.drawImage(
            images.enemyMinion,
            enemy.x,
            enemy.y,
            enemy.width,
            enemy.height
          );
        } else {
          ctx.fillStyle = "#ff4500";
          ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        }
      }

      // ========== UPDATE LOGIC ==========
      function updatePlayer() {
        drawPlayer();
        if (gameState.player.shieldTime > 0) {
          gameState.player.shieldTime--;
          if (gameState.player.shieldTime <= 0) gameState.player.shield = false;
        }
      }

      function spawnEnemies() {
        let count = 1;
        if (gameState.score >= 120) count = 2;
        if (gameState.score >= 260) count = 3;
        if (gameState.phase === 2)  count += 1;  // phase 2 đông hơn
        count = Math.min(count, 6);  // trần an toàn

        for (let i = 0; i < count; i++) {
          const now = Date.now();
          if (now - gameState.lastEnemySpawn > gameState.enemySpawnRate) {
            const types =
              gameState.score > 150
                ? ["minion", "banana", "minion", "banana"]
                : ["minion", "minion", "minion", "banana"];
            const type = types[Math.floor(Math.random() * types.length)];
            gameState.enemies.push({
              x: canvas.width,
              y: Math.random() * (canvas.height - 60),
              width: type === "banana" ? 90 : 70,
              height: type === "banana" ? 60 : 45,
              speed: type === "banana" ? 3 : 5,
              type,
            });
            gameState.lastEnemySpawn = now;
            if (gameState.enemySpawnRate > 800) gameState.enemySpawnRate -= 10;
          }
        }
      }

      // ===== Tăng số lượng spawn theo điểm/phase (không đụng timer) =====
      (function(){
        const _spawnEnemies = typeof spawnEnemies === "function" ? spawnEnemies : null;
        if (!_spawnEnemies) return;

        // Quy tắc: điểm càng cao → mỗi lần gọi spawnEnemies() sẽ spawn nhiều đợt hơn
        function getExtraSpawnCount() {
          let extra = 0;  // 0 = chỉ 1 đợt (mặc định)
          if (gameState.score >= 80) extra = 1;     // +1 đợt
          if (gameState.score >= 160) extra = 2;     // +2 đợt
          if (gameState.phase === 2)  extra += 1;    // vào phase 2 bonus thêm 1 đợt
          return Math.min(extra, 8);                 // trần an toàn
        }

        // Ghi đè nhẹ: mỗi lần game gọi spawnEnemies(), ta gọi thêm 'extra' lần
        window.spawnEnemies = function(){
          // 1 đợt gốc như cũ
          _spawnEnemies();

          // + đợt phụ tuỳ theo độ khó
          const extra = getExtraSpawnCount();
          for (let i = 0; i < extra; i++) _spawnEnemies();
        };
      })();

      function updateEnemies() {
        const now = performance.now();
        for (let i = gameState.enemies.length - 1; i >= 0; i--) {
          const enemy = gameState.enemies[i];

          // di chuyển
          enemy.x -= enemy.speed * (gameState.deltaTime / 16);
          if (enemy.x + enemy.width < 0) {
            gameState.enemies.splice(i, 1);
            continue;
          }

          // vẽ
          drawEnemy(enemy);

          // bắn theo cooldown riêng từng loại
          const ownerType = TYPE_ALIAS[enemy.type] || "nom";
          const cfg = ENEMY_BULLET[ownerType];
          const cd = cfg?.cooldown ?? 800;
          if (!enemy.lastShot) enemy.lastShot = 0;
          if (now - enemy.lastShot >= cd) {
            enemyShoot(enemy); // sẽ tự lấy config theo loại
            enemy.lastShot = now;
          }
        }
      }

      function updateProjectiles() {
        // Player projectiles
        for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
          const proj = gameState.projectiles[i];
          proj.x += proj.speed * (gameState.deltaTime / 16);
          if (proj.x > canvas.width) {
            gameState.projectiles.splice(i, 1);
            continue;
          }
          const sprite =
            proj.type === "special" ? images.bulletSpecial : images.bullet;
          if (sprite)
            ctx.drawImage(sprite, proj.x, proj.y, proj.width, proj.height);
          else {
            ctx.fillStyle = proj.type === "special" ? "#ffa500" : "#00ff00";
            ctx.fillRect(proj.x, proj.y, proj.width, proj.height);
          }
        }
        // Enemy projectiles (đã hỗ trợ vx, vy + sprite hoặc màu)
        for (let i = gameState.enemyProjectiles.length - 1; i >= 0; i--) {
          const proj = gameState.enemyProjectiles[i];
          const dt = gameState.deltaTime / 16;

          // Hỗ trợ kiểu cũ (nếu còn) lẫn mới (vx, vy)
          const vx = typeof proj.vx === "number" ? proj.vx : -(proj.speed || 8);
          const vy = typeof proj.vy === "number" ? proj.vy : 0;

          proj.x += vx * dt;
          proj.y += vy * dt;

          // ra khỏi màn thì bỏ
          if (
            proj.x + proj.width < -40 ||
            proj.x > canvas.width + 40 ||
            proj.y + proj.height < -40 ||
            proj.y > canvas.height + 40
          ) {
            gameState.enemyProjectiles.splice(i, 1);
            continue;
          }

          if (proj.img) {
            ctx.drawImage(proj.img, proj.x, proj.y, proj.width, proj.height);
          } else {
            ctx.fillStyle = proj.color || "#ff0000";
            ctx.fillRect(proj.x, proj.y, proj.width, proj.height);
          }
        }
      }

      // ========== GAME ACTIONS ==========
      function playerAttack() {
        if (!gameState.running) return;
        const p = gameState.player;
        gameState.projectiles.push({
          x: p.x + p.width,
          y: p.y + p.height / 2 - 5,
          width: 20,
          height: 10,
          speed: 18,
          damage: DAMAGE_CONFIG.bullet,
          type: "normal",
        });
      }

      function specialAttack() {
        if (!gameState.running || gameState.score < 30) return;
        const p = gameState.player;
        for (let i = -2; i <= 2; i++) {
          gameState.projectiles.push({
            x: p.x + p.width,
            y: p.y + p.height / 2 - 7 + i * 12,
            width: 25,
            height: 14,
            speed: 20,
            damage: DAMAGE_CONFIG.special,
            type: "special",
          });
        }
        gameState.score -= 30;
      }

      function activateShield() {
        if (gameState.player.shieldTime <= 0) {
          gameState.player.shield = true;
          gameState.player.shieldTime = 300; // ~3s
          createShieldEffect(
            gameState.player.x + gameState.player.width / 2,
            gameState.player.y + gameState.player.height / 2
          );
        }
      }

      function enemyShoot(enemyOrType, xArg, yArg) {
        // Cho phép gọi 2 kiểu:
        // - enemyShoot(enemy)  // updateEnemies đang gọi kiểu này
        // - enemyShoot("boss", x, y) // khi bạn bắn từ boss
        let ownerType, sx, sy;
        if (typeof enemyOrType === "string") {
          ownerType = enemyOrType;
          sx = xArg;
          sy = yArg;
        } else {
          const e = enemyOrType;
          ownerType = TYPE_ALIAS[e.type] || "nom";
          sx = e.x;
          sy = e.y + e.height / 2;
        }

        const cfg = ENEMY_BULLET[ownerType];
        if (!cfg) return;

        const dmg = randInt(cfg.damage[0], cfg.damage[1]);
        const angLeft = Math.PI; // bắn sang trái
        const p = gameState.player;
        const angAimed =
          Math.atan2(p.y + p.height / 2 - sy, p.x + p.width / 2 - sx) +
          (cfg.jitter || 0) * (Math.random() - 0.5) * 2;

        const push = (ang) => {
          const vx = Math.cos(ang) * cfg.speed;
          const vy = Math.sin(ang) * cfg.speed;
          const proj = {
            x: sx,
            y: sy - cfg.size.h / 2,
            width: cfg.size.w,
            height: cfg.size.h,
            vx,
            vy,
            speed: cfg.speed,
            damage: dmg,
            ownerType,
            color: cfg.color || "#ff0000",
          };
          if (cfg.sprite) {
            const img = new Image();
            img.onload = () => { proj.img = img; };       // chỉ gắn khi load OK
            img.onerror = () => { delete proj.img; };     // hỏng thì vẽ hình chữ nhật
            img.src = cfg.sprite;
          }
          gameState.enemyProjectiles.push(proj);
        };

        switch (cfg.pattern) {
          case "aimed":
            push(angAimed);
            break;
          case "spread3": {
            const s = cfg.spreadAngle ?? 0.2;
            [angLeft - s, angLeft, angLeft + s].forEach(push);
            break;
          }
          case "straight":
          default:
            push(angLeft);
        }
      }

      // ========== COLLISION DETECTION ==========
      function checkCollisions() {
        const p = gameState.player;
        // Player bullets vs Enemies
        for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
          const proj = gameState.projectiles[i];
          for (let j = gameState.enemies.length - 1; j >= 0; j--) {
            const enemy = gameState.enemies[j];
            if (isColliding(proj, enemy)) {
              gameState.enemies.splice(j, 1);
              gameState.projectiles.splice(i, 1);
              const points = enemy.type === "banana" ? 50 : 10;
              const comboBonus = Math.floor(gameState.combo / 5);
              const totalPoints = points + points * comboBonus * 0.5;
              gameState.score += totalPoints;
              gameState.combo++;
              gameState.lastComboTime = Date.now();
              if (gameState.combo > 1)
                createComboEffect(enemy.x, enemy.y, gameState.combo);
              createExplosion(
                enemy.x + enemy.width / 2,
                enemy.y + enemy.height / 2
              );
              break;
            }
          }
        }
        // Enemy bullets vs Player
        for (let i = gameState.enemyProjectiles.length - 1; i >= 0; i--) {
          const proj = gameState.enemyProjectiles[i];
          if (isColliding(proj, p) && p.invulnerable <= 0) {
            if (!p.shield) {
              p.health -= proj.damage;
              p.invulnerable = 60;
              if (p.health <= 0) gameOver(false);
            }
            gameState.enemyProjectiles.splice(i, 1);
            createExplosion(proj.x, proj.y);
            gameState.combo = 0;
          }
        }
        // Enemies vs Player
        for (let i = gameState.enemies.length - 1; i >= 0; i--) {
          const enemy = gameState.enemies[i];
          if (isColliding(enemy, p) && p.invulnerable <= 0) {
            if (!p.shield) {
              p.health -= 30;
              p.invulnerable = 60;
              if (p.health <= 0) gameOver(false);
            }
            gameState.enemies.splice(i, 1);
            createExplosion(
              enemy.x + enemy.width / 2,
              enemy.y + enemy.height / 2
            );
            gameState.combo = 0;
          }
        }
      }

      function isColliding(a, b) {
        return (
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y
        );
      }

      // ========== VICTORY CONDITION ==========
      function checkVictory() {
        if (gameState.score >= gameState.victoryPoints) {
          gameState.running = false;
          showVictoryScreen();
        }
      }
      // Thắng chỉ khi hạ boss. Điểm chỉ dùng để chuyển pha.
      function checkVictory() {
        // Đang ở Phase 2: không xét điểm nữa
        if (gameState.phase === 2) {
          // bossDead được set ở đoạn xử lý trúng đạn boss
          if (gameState.bossDead && !gameState._victoryShown) {
            gameState._victoryShown = true; // chốt 1 lần
            const bar = document.getElementById("bossHP"); // ẩn thanh máu boss
            if (bar) bar.style.display = "none";
            // Bạn có thể gọi cutscene ngay tại đây, hoặc hiện Victory Screen trước:
            if (typeof showVictoryScreen === "function") showVictoryScreen();
            // hoặc nếu bạn dùng cinematic nổ rồi playVideo2(), giữ nguyên flow đó
          }
          return; // KHÔNG xét điều kiện score nữa
        }

        // Phase 1: đủ điểm thì CHUYỂN PHA, KHÔNG THẮNG
        if (gameState.score >= gameState.victoryPoints) {
          gameState.phase = 2; // chuyển sang phase boss
          // không cần gọi spawnBoss ở đây; spawnEnemies() sẽ tự gọi trong 1-2 frame tới
          const goal = document.getElementById("victoryGoal");
          if (goal) goal.textContent = "Objective: Defeat the Boss";
          const progressBar = document.getElementById("progressBar");
          if (progressBar) progressBar.style.width = "0%"; // ngưng đo tiến độ theo điểm
        }
      }
      function createVictoryEffects() {
        for (let i = 0; i < 50; i++) {
          setTimeout(() => {
            for (let j = 0; j < 5; j++) {
              const particle = document.createElement("div");
              particle.className = "victory-particle";
              particle.style.left = Math.random() * 100 + "vw";
              particle.style.top = "100vh";
              particle.style.background = ["#ffd700", "#ff69b4", "#00bfff"][
                Math.floor(Math.random() * 3)
              ];
              document.getElementById("victoryScreen").appendChild(particle);
              setTimeout(() => {
                particle.remove();
              }, 3000);
            }
          }, i * 100);
        }
      }

      // ========== EFFECTS ==========
      function createExplosion(x, y) {
        // Nếu có sprite nổ, vẽ sprite; nếu không, dùng particle đơn giản
        if (images.explosion) {
          ctx.save();
          ctx.globalAlpha = 0.9;
          ctx.drawImage(images.explosion, x - 30, y - 30, 60, 60);
          ctx.restore();
        } else {
          for (let i = 0; i < 15; i++) {
            gameState.particles.push({
              x,
              y,
              vx: (Math.random() - 0.5) * 8,
              vy: (Math.random() - 0.5) * 8,
              life: 30,
              color: ["#ff4500", "#ffd700", "#ffffff"][
                Math.floor(Math.random() * 3)
              ],
              size: Math.random() * 3 + 2,
            });
          }
        }
      }

      function createShieldEffect(x, y) {
        for (let i = 0; i < 20; i++) {
          const angle = (i / 20) * Math.PI * 2;
          gameState.particles.push({
            x,
            y,
            vx: Math.cos(angle) * 3,
            vy: Math.sin(angle) * 3,
            life: 40,
            color: "#00bfff",
            size: Math.random() * 2 + 1,
          });
        }
      }

      function createComboEffect(x, y, combo) {
        const el = document.createElement("div");
        el.className = "combo-popup";
        el.textContent = `${combo}x COMBO!`;
        el.style.left = x + "px";
        el.style.top = y + "px";
        document.getElementById("gameScene").appendChild(el);
        setTimeout(() => el.remove(), 1000);
      }

      function updateParticles() {
        for (let i = gameState.particles.length - 1; i >= 0; i--) {
          const p = gameState.particles[i];
          p.x += p.vx * (gameState.deltaTime / 16);
          p.y += p.vy * (gameState.deltaTime / 16);
          p.life--;
          if (p.life <= 0) {
            gameState.particles.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = p.life / 30;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      function updateCombo() {
        if (Date.now() - gameState.lastComboTime > 3000 && gameState.combo > 0)
          gameState.combo = 0;
      }

      // ========== UI & DIALOG ==========
      function updateUI() {
        const hpPercent = (gameState.player.health / gameState.player.maxHealth) * 100;

        const progressBar = document.getElementById("progressBar");
        const goalEl = document.getElementById("victoryGoal");
        const healthBar = document.getElementById("healthBar");
        const healthText = document.getElementById("healthText");
        const scoreEl = document.getElementById("score");
        const comboEl = document.getElementById("combo");

        // Goal text
        if (goalEl) {
          if (gameState.phase === 2) {
            goalEl.textContent = "Objective: Defeat the Boss";
          } else {
            goalEl.textContent = `Objective: ${Math.round(gameState.score)}/${gameState.victoryPoints} score`;
          }
        }

        // Progress bar
        if (gameState.phase !== 2) {
          const victoryPercent = Math.max(
            0,
            Math.min(100, (gameState.score / gameState.victoryPoints) * 100)
          );
          if (progressBar) {
            progressBar.style.width = victoryPercent + "%";
            if (victoryPercent >= 100) {
              progressBar.style.background =
                "linear-gradient(90deg, #ffd700, #ffff00)";
            } else if (victoryPercent >= 75) {
              progressBar.style.background =
                "linear-gradient(90deg, #00ff00, #00bfff)";
            } else if (victoryPercent >= 50) {
              progressBar.style.background =
                "linear-gradient(90deg, #ff69b4, #ff1493)";
            } else {
              progressBar.style.background = "";
            }
          }
        } else {
          // sang phase 2: thanh tiến độ không còn dùng điểm
          if (progressBar) {
            progressBar.style.width = "0%";
            progressBar.style.background = "";
          }
        }

        // HP bar + text
        if (healthBar) healthBar.style.width = hpPercent + "%";
        if (healthText)
          healthText.textContent = `HP: ${Math.round(
            gameState.player.health
          )}/${gameState.player.maxHealth}`;

        if (scoreEl) scoreEl.textContent = `Score ${Math.round(gameState.score)}`;

        if (comboEl) {
          if (gameState.combo >= 10) {
            comboEl.style.color = "#ff00ff";
            comboEl.style.textShadow = "0 0 10px #ff00ff";
          } else if (gameState.combo >= 5) {
            comboEl.style.color = "#ffff00";
            comboEl.style.textShadow = "0 0 10px #ffff00";
          } else {
            comboEl.style.color = "#00ff00";
            comboEl.style.textShadow = "2px 2px 4px rgba(0,0,0,0.5)";
          }
          comboEl.textContent = `Combo: ${gameState.combo}x`;
        }

        const specialBtn = document.getElementById("specialBtn");
        if (specialBtn) specialBtn.disabled = gameState.score < 30;
        const mobileSpecial = document.getElementById("mobileSpecial");
        if (mobileSpecial) mobileSpecial.disabled = gameState.score < 30;
      }

      function gameOver(victory) {
        gameState.running = false;
        document.getElementById("gameOverText").textContent = victory
          ? "Victory!"
          : "Defeated!";
        document.getElementById("finalScore").textContent = `Score ${Math.round(
          gameState.score
        )}`;
        document.getElementById("gameOver").style.display = "flex";
      }

      // Handle window resize
      window.addEventListener("resize", () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      });
      canvas.addEventListener("contextmenu", (e) => e.preventDefault());

      // document.addEventListener("keydown", (Enter) => {
      //   if (Enter.key === "Enter") {
      //     const ss = document.getElementById("mainGame");
      //     if (ss && ss.style.display !== "none") {
      //       showMainMenu();
      //     }
      //   }
      // });

      // ========== AUTOPLAY CREDITS ON LOAD ==========
      window.addEventListener("load", () => {
        // Ẩn màn hình Start để video không bị che (muốn hiện Start thì bỏ 2 dòng dưới)
        const ss = document.getElementById("startScreen");
        if (ss) ss.style.display = "none";

        try {
          playCredits(); // gọi video mở đầu ngay khi tải trang
        } catch (e) {
          console.warn("Autoplay on load failed:", e);
        }
      });
      (function () {
        // === Tuỳ chỉnh nhanh (đổi số là đổi gameplay) ===
        const PHASE_CONFIG = {
          phase1To2Score: 180, // đạt điểm này -> vào Phase 2
          boss: {
            hp: 600, // máu boss
            touchDamage: 50,
            bulletDamage: 25,
            speed: 1.5,
            width: 160,
            height: 120,
            shootDelay: 900,
          },
          minion: { points: 10 },
          banana: { points: 50 },
        };

        // Damage config (chỉnh tại đây là đủ)
        window.DAMAGE_CONFIG = window.DAMAGE_CONFIG || {
          bullet: 25,
          special: 70,
        };

        // Tạo UI (cảnh báo + thanh máu boss) trong #gameScene
        function ensureBossUI() {
          const root = document.getElementById("gameScene");
          if (!root || document.getElementById("bossWarning")) return;
          const warn = document.createElement("div");
          warn.id = "bossWarning";
          warn.textContent = "⚠ Warning! Boss Incoming!";
          const bar = document.createElement("div");
          bar.id = "bossHP";
          const fill = document.createElement("div");
          fill.id = "bossHPFill";
          bar.appendChild(fill);
          root.appendChild(warn);
          root.appendChild(bar);
        }
        ensureBossUI();

        // Mở rộng state (không phá đồ cũ)
        if (!("phase" in gameState)) {
          gameState.phase = 1;
          gameState.boss = null;
          gameState.bossDead = false;
          gameState.bossLastShot = 0;
        }

        function updateBossHPUI() {
          const bar = document.getElementById("bossHP");
          const fill = document.getElementById("bossHPFill");
          if (!gameState.boss || !bar || !fill) {
            if (bar) bar.style.display = "none";
            return;
          }
          bar.style.display = "block";
          const pct =
            (Math.max(0, gameState.boss.hp) / PHASE_CONFIG.boss.hp) * 100;
          fill.style.width = pct + "%";
        }
        function showBossWarning() {
          const el = document.getElementById("bossWarning");
          if (!el) return;
          el.style.display = "flex";
          setTimeout(() => (el.style.display = "none"), 1800);
        }
        function spawnBoss() {
          if (gameState.boss) return;
          gameState.boss = {
            x: canvas.width + 10,
            y: canvas.height * 0.2 + Math.random() * canvas.height * 0.5,
            width: PHASE_CONFIG.boss.width,
            height: PHASE_CONFIG.boss.height,
            speed: PHASE_CONFIG.boss.speed,
            hp: PHASE_CONFIG.boss.hp,
            type: "boss",
            vx: -PHASE_CONFIG.boss.speed,
            vy: 0,
            lastShot: 0,
          };
          showBossWarning();
        }

        // --- override: spawnEnemies (giữ logic cũ + kích hoạt phase 2) ---
        const _spawnEnemies =
          typeof spawnEnemies === "function" ? spawnEnemies : null;
        window.spawnEnemies = function () {
          // FIX: Nếu đã sang Phase 2 (do chỗ khác set) mà boss chưa có → spawn ngay
          if (gameState.phase === 2 && !gameState.boss) {
            spawnBoss();
          }
          // Phase 1: đủ ngưỡng thì vào Phase 2 + gọi boss
          if (
            gameState.phase === 1 &&
            gameState.score >= PHASE_CONFIG.phase1To2Score
          ) {
            gameState.phase = 2;
            spawnBoss();
          }
          if (_spawnEnemies) _spawnEnemies(); // vẫn spawn minion/banana như cũ
        };

        // --- override: updateEnemies (vẽ/cập nhật boss & bắn đạn) ---
        const _updateEnemies =
          typeof updateEnemies === "function" ? updateEnemies : null;
        window.updateEnemies = function () {
          if (gameState.boss && gameState.boss.hp > 0) {
            const b = gameState.boss;
            if (b.x > canvas.width - b.width - 40)
              b.x += b.vx * (gameState.deltaTime / 16);
            else b.y += Math.sin(performance.now() / 600) * 1.8;

            if (images.boss)
              ctx.drawImage(images.boss, b.x, b.y, b.width, b.height);
            else {
              ctx.fillStyle = "#8b0000";
              ctx.fillRect(b.x, b.y, b.width, b.height);
            }

            if (performance.now() - b.lastShot > PHASE_CONFIG.boss.shootDelay) {
              enemyShoot("boss", b.x, b.y + b.height / 2);
              b.lastShot = performance.now();
            }
            updateBossHPUI();
          }
          if (_updateEnemies) _updateEnemies();
        };

        // --- override: checkCollisions (đạn người chơi trừ máu boss) ---
        const _checkCollisions =
          typeof checkCollisions === "function" ? checkCollisions : null;
        window.checkCollisions = function () {
          if (gameState.boss && gameState.boss.hp > 0) {
            for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
              const proj = gameState.projectiles[i],
                b = gameState.boss;
              if (
                proj.x < b.x + b.width &&
                proj.x + proj.width > b.x &&
                proj.y < b.y + b.height &&
                proj.y + proj.height > b.y
              ) {
                gameState.projectiles.splice(i, 1);
                b.hp -= proj.damage; // đạn thường của bạn đang để 999 dmg :contentReference[oaicite:2]{index=2}
                createExplosion(b.x + b.width / 2, b.y + b.height / 2);
                updateBossHPUI();
                if (b.hp <= 0) {
                  gameState.bossDead = true;
                  setTimeout(() => {
                    const bar = document.getElementById("bossHP");
                    if (bar) bar.style.display = "none";
                  }, 600);
                }
              }
            }
          }
          if (_checkCollisions) _checkCollisions();

          // Boss chạm player
          if (gameState.boss && gameState.boss.hp > 0) {
            const b = gameState.boss,
              p = gameState.player;
            if (
              p &&
              p.invulnerable <= 0 &&
              p.x < b.x + b.width &&
              p.x + p.width > b.x &&
              p.y < b.y + b.height &&
              p.y + p.height > b.y
            ) {
              if (!p.shield) {
                p.health -= PHASE_CONFIG.boss.touchDamage;
                p.invulnerable = 60;
                if (p.health <= 0) gameOver(false);
              }
              createExplosion(p.x + p.width / 2, p.y + p.height / 2);
            }
          }
        };

        // --- override: checkVictory (thắng khi hạ boss) ---
        const _checkVictory =
          typeof checkVictory === "function" ? checkVictory : null;
        window.checkVictory = function () {
          if (gameState.phase === 2) {
            if (gameState.bossDead) gameOver(true);
          } else if (gameState.score >= PHASE_CONFIG.phase1To2Score) {
            gameState.phase = 2;
            spawnBoss();
          }
        };

        // Reset khi bắt đầu trận mới (giữ nguyên startBattle cũ)
        const _startBattle =
          typeof startBattle === "function" ? startBattle : null;
        window.startBattle = function () {
          gameState.phase = 1;
          gameState.boss = null;
          gameState.bossDead = false;
          const warn = document.getElementById("bossWarning");
          if (warn) warn.style.display = "none";
          const bar = document.getElementById("bossHP");
          if (bar) bar.style.display = "none";
          if (_startBattle) return _startBattle();
        };

        // Bạn có thể sửa live trong console: TWO_PHASE_CONFIG
        window.TWO_PHASE_CONFIG = PHASE_CONFIG;
      })();

      // ===== White Dissolve → playVideo2() =====
      (function () {
        function runWhiteDissolveThenEnding({ duration = 900 } = {}) {
          const wrap = document.getElementById("fxDissolve");
          const cvs = document.getElementById("fxDissolveCanvas");
          if (!wrap || !cvs) {
            if (typeof playVideo2 === "function") playVideo2();
            return;
          }

          // Tạm dừng gameplay để tránh frame vẽ chồng
          if (window.gameState) gameState.running = false;

          // Setup canvas (render 50% kích thước để mượt)
          const scale = 0.5,
            ratio = window.devicePixelRatio || 1;
          const W = Math.max(2, Math.floor(wrap.clientWidth * scale * ratio));
          const H = Math.max(2, Math.floor(wrap.clientHeight * scale * ratio));
          cvs.width = W;
          cvs.height = H;

          // Noise 0..255
          const noise = new Uint8Array(W * H);
          if (crypto && crypto.getRandomValues) crypto.getRandomValues(noise);
          else
            for (let i = 0; i < noise.length; i++)
              noise[i] = (Math.random() * 255) | 0;

          const ctx = cvs.getContext("2d", { willReadFrequently: true });
          wrap.style.display = "block";

          let t = 0;
          const step = 16 / duration; // ~60fps
          function draw(p) {
            const img = ctx.createImageData(W, H);
            const d = img.data;
            const thr = p * 255;
            for (let i = 0; i < noise.length; i++) {
              if (noise[i] < thr) {
                const k = i * 4;
                d[k] = d[k + 1] = d[k + 2] = 255; // WHITE dissolve
                d[k + 3] = 255;
              }
            }
            ctx.putImageData(img, 0, 0);
          }

          function loop() {
            t += step;
            if (t >= 1) {
              draw(1);
              // Đã phủ trắng toàn màn → gọi ending
              setTimeout(() => {
                wrap.style.display = "none";
                if (typeof playVideo2 === "function") playVideo2();
              }, 50);
              return;
            }
            draw(t);
            requestAnimationFrame(loop);
          }
          requestAnimationFrame(loop);
        }

        // ===== Sửa điều kiện thắng: chỉ khi boss chết =====
        // 1) Vô hiệu hoá màn VictoryScreen cũ bằng cách override hàm cũ:
        window.showVictoryScreen = function () {
          /* no-op: không hiện VictoryScreen nữa */
        };

        // 2) Thay checkVictory: Phase 1 đủ điểm -> chuyển Phase 2; Phase 2 chỉ kết thúc khi bossDead
        const _checkVictory =
          typeof checkVictory === "function" ? checkVictory : null;
        window.checkVictory = function () {
          // Nếu đã vào phase 2, chỉ chốt khi boss chết
          if (gameState.phase === 2) {
            if (gameState.bossDead && !gameState._endingStarted) {
              gameState._endingStarted = true;
              // Ẩn thanh máu boss nếu còn
              const bar = document.getElementById("bossHP");
              if (bar) bar.style.display = "none";
              runWhiteDissolveThenEnding({ duration: 900 }); // dissolve trắng rồi playVideo2()
            }
            return; // KHÔNG xét score ở Phase 2
          }

          // Phase 1: đạt điểm mục tiêu -> CHUYỂN PHA, KHÔNG THẮNG
          if (gameState.score >= gameState.victoryPoints) {
            gameState.phase = 2; // boss sẽ được spawn bởi spawnEnemies() override của bạn
            // Cập nhật UI mục tiêu nếu có
            const goal = document.getElementById("victoryGoal");
            if (goal) goal.textContent = "Objective: Defeat the Boss";
            const progressBar = document.getElementById("progressBar");
            if (progressBar) progressBar.style.width = "0%";
          }

          // Nếu bạn còn logic khác trong bản cũ, gọi lại:
          if (_checkVictory && _checkVictory !== window.checkVictory) {
            /* bỏ để tránh vòng lặp */
          }
        };

        // 3) Reset cờ khi bắt đầu/chơi lại
        function resetPhaseFlags() {
          gameState.phase = 1;
          gameState.boss = null;
          gameState.bossDead = false;
          gameState._endingStarted = false;
        }
        const _startBattle =
          typeof startBattle === "function" ? startBattle : null;
        window.startBattle = function () {
          resetPhaseFlags();
          return _startBattle ? _startBattle() : undefined;
        };
        const _restartGame =
          typeof restartGame === "function" ? restartGame : null;
        window.restartGame = function () {
          resetPhaseFlags();
          return _restartGame ? _restartGame() : undefined;
        };
        const _returnToStart =
          typeof returnToStart === "function" ? returnToStart : null;
        window.returnToStart = function () {
          resetPhaseFlags();
          return _returnToStart ? _returnToStart() : undefined;
        };
      })();

      // ========= AssetManager =========
      const MEDIA = {
        videos: {
          intro: { hi: "./assets/intro.mp4", lo: "./assets/intro_low.mp4" },
          ending: { hi: "./assets/ending.mp4", lo: "./assets/ending_low.mp4" },
          credits: {
            hi: "./assets/credits.mp4",
            lo: "./assets/credits_low.mp4",
          },
        },
        // Ảnh nền / icon hay dùng (tuỳ bạn bổ sung)
        images: [
          "./assets/start.png",
          "./assets/main_menu.png",
          "./assets/icon.png",
        ],
      };

      const Net = (() => {
        const c = navigator.connection || {};
        const slow =
          (c.effectiveType && /^(slow-2g|2g)$/i.test(c.effectiveType)) ||
          c.saveData;
        return { isSlow: !!slow };
      })();

      const AssetManager = {
        videoCache: new Map(),
        imageCache: new Map(),

        preloadImage(url) {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              AssetManager.imageCache.set(url, img);
              resolve(img);
            };
            img.onerror = () => {
              console.warn("IMG preload fail:", url);
              resolve(null);
            };
            img.src = url;
          });
        },

        // Chờ loadeddata/canplaythrough, timeout để không treo
        preloadVideo(url, { timeout = 10000, muted = true } = {}) {
          return new Promise((resolve) => {
            const v = document.createElement("video");
            v.preload = "auto";
            v.muted = !!muted;
            v.playsInline = true;
            v.setAttribute("playsinline", "");
            let done = false;
            const finish = () => {
              if (done) return;
              done = true;
              resolve(v);
            };
            const timer = setTimeout(finish, timeout);
            v.oncanplaythrough = () => {
              clearTimeout(timer);
              finish();
            };
            v.onloadeddata = () => {
              clearTimeout(timer);
              finish();
            };
            v.onerror = () => {
              clearTimeout(timer);
              console.warn("VIDEO preload fail:", url);
              finish();
            };
            v.src = url;
            v.load();
          });
        },

        pickVideoSrc(key) {
          const cfg = MEDIA.videos[key];
          if (!cfg) return null;
          return Net.isSlow && cfg.lo ? cfg.lo : cfg.hi;
        },

        async warmup() {
          // Ảnh giao diện
          await Promise.all(MEDIA.images.map(AssetManager.preloadImage));

          // Video sắp dùng (credits/ending/intro)
          for (const k of ["intro", "ending", "credits"]) {
            const src = AssetManager.pickVideoSrc(k);
            if (!src) continue;
            if (!AssetManager.videoCache.has(k)) {
              const v = await AssetManager.preloadVideo(src, {
                timeout: 8000,
                muted: true,
              });
              AssetManager.videoCache.set(k, { src, el: v });
            }
          }
        },
      };

      // Loader helpers
      function showLoader(msg = "Loading…") {
        const ov = document.getElementById("loadingOverlay");
        const tx = document.getElementById("loadingText");
        if (tx) tx.textContent = msg;
        ov.style.display = "flex";
      }
      function hideLoader() {
        const ov = document.getElementById("loadingOverlay");
        ov.style.display = "none";
      }

      // Tự khởi động warming ngay khi vào game
      window.addEventListener("load", () => {
        AssetManager.warmup();
      });
      (function () {
        // === Config nhạc nền ===
        const AUDIO_CONFIG = {
          src: "./assets/bgm.mp3", // đổi path tùy bạn
          volume: 1.5, // âm lượng khi bình thường
          duckDuringVideo: true, // hãm nhỏ khi đang phát video/cutscene
          duckVolume: 1, // âm lượng khi duck
          fadeMs: 400, // thời gian fade in/out
        };

        // Tạo <audio> chạy ngầm
        const bgm = document.createElement("audio");
        bgm.id = "bgm";
        bgm.src = AUDIO_CONFIG.src;
        bgm.loop = true;
        bgm.preload = "auto";
        bgm.muted = true; // autoplay-friendly
        bgm.volume = 0; // sẽ fade lên sau
        document.body.appendChild(bgm);

        // helper fade âm lượng
        function fadeTo(target, ms) {
          target = Math.max(0, Math.min(1, target));
          const start = bgm.volume,
            diff = target - start;
          if (ms <= 0) {
            bgm.volume = target;
            return;
          }
          const startT = performance.now();
          function tick(now) {
            const t = Math.min(1, (now - startT) / ms);
            bgm.volume = start + diff * t;
            if (t < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        }

        async function ensurePlay() {
          try {
            await bgm.play();
          } catch (e) {
            /* sẽ unmute sau khi user chạm */
          }
        }
        async function playBGM() {
          await ensurePlay();
          if (bgm.muted) bgm.muted = false;
          fadeTo(AUDIO_CONFIG.volume, AUDIO_CONFIG.fadeMs);
        }
        function duckBGM(on) {
          const v = on ? AUDIO_CONFIG.duckVolume : AUDIO_CONFIG.volume;
          fadeTo(v, AUDIO_CONFIG.fadeMs);
        }

        // Bật nhạc sau cú chạm đầu tiên ở bất kỳ đâu
        document.addEventListener(
          "pointerdown",
          function once() {
            playBGM();
            const btn = document.getElementById("bgmToggle");
            if (btn) btn.textContent = "🔊";
            document.removeEventListener("pointerdown", once);
          },
          { once: true }
        );

        // Thử autoplay (muted) ngay khi load để cache buffer
        window.addEventListener("load", ensurePlay);

        // Nút tắt/mở nhạc
        const btn = document.getElementById("bgmToggle");
        if (btn) {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (bgm.muted || bgm.volume === 0) {
              playBGM();
              btn.textContent = "🔊";
            } else {
              fadeTo(0, 200);
              setTimeout(() => {
                bgm.muted = true;
              }, 220);
              btn.textContent = "🔇";
            }
          });
        }

        // --- Tự động duck khi vào/ra video & credits/cutscene ---
        function wrap(name, onStart, onEnd) {
          const orig = window[name];
          if (typeof orig !== "function") return;
          window[name] = function (...args) {
            if (AUDIO_CONFIG.duckDuringVideo) onStart?.();
            const ret = orig.apply(this, args);
            // nếu có videoPlayer, mở xong thì un-duck khi kết thúc / skip
            const v = document.getElementById("videoPlayer");
            if (v && AUDIO_CONFIG.duckDuringVideo) {
              const off = () => {
                onEnd?.();
                v.removeEventListener("ended", off);
              };
              v.addEventListener("ended", off, { once: true });
            }
            return ret;
          };
        }

        wrap(
          "playVideo1",
          () => duckBGM(true),
          () => duckBGM(false)
        );
        wrap(
          "playVideo2",
          () => duckBGM(true),
          () => duckBGM(false)
        );
        wrap(
          "playCredits",
          () => duckBGM(true),
          () => duckBGM(false)
        );

        // Khi bấm Skip video → un-duck
        const _skip = window.skipVideo;
        if (typeof _skip === "function") {
          window.skipVideo = function (...args) {
            const r = _skip.apply(this, args);
            if (AUDIO_CONFIG.duckDuringVideo) duckBGM(false);
            return r;
          };
        }

        // Xuất vài API ra global nếu bạn muốn gọi thủ công
        window.playBGM = playBGM;
        window.duckBGM = duckBGM;
      })();
      (function () {
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');

        function resizeHiDPI() {
          const dpr = window.devicePixelRatio || 1;
          const rect = canvas.getBoundingClientRect();
          const w = Math.max(rect.width || window.innerWidth, 1);
          const h = Math.max(rect.height || window.innerHeight, 1);
          canvas.width  = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
          // reset mọi transform để không bị “kéo dãn” từ lần trước
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.imageSmoothingEnabled = false;
        }

        // chạy khi tải & khi resize
        resizeHiDPI();
        window.addEventListener('resize', resizeHiDPI);
        // để nơi khác có thể gọi lại sau khi show/hide màn
        window._resizeHiDPI = resizeHiDPI;
      })();
      (function () {
        // ===== Config gọn, dễ chỉnh =====
        const PHASE = {
          threshold: 180, // Điểm để chuyển Phase 1 -> 2
          boss: {
            hp: 600, width: 160, height: 120, speed: 1.5,
            touchDamage: 50, bulletDamage: 25, shootDelay: 900
          }
        };

        // ===== Mở rộng state an toàn =====
        gameState.phase ??= 1;
        gameState.boss ??= null;
        gameState.bossDead ??= false;
        gameState.bossLastShot ??= 0;

        // ===== UI cảnh báo + thanh máu boss (idempotent) =====
        function ensureBossUI() {
          const root = document.getElementById('gameScene');
          if (!root) return;
          if (!document.getElementById('bossHP')) {
            const warn = document.createElement('div');
            warn.id = 'bossWarning';
            warn.textContent = '⚠ BOSS SẮP XUẤT HIỆN!';
            Object.assign(warn.style, {
              position:'absolute', top:'20px', left:'50%', transform:'translateX(-50%)',
              padding:'8px 14px', background:'rgba(0,0,0,.6)', color:'#fff',
              border:'1px solid #f66', borderRadius:'10px', zIndex:'12', display:'none'
            });

            const bar = document.createElement('div');
            bar.id = 'bossHP';
            Object.assign(bar.style, {
              position:'absolute', top:'60px', left:'50%', transform:'translateX(-50%)',
              width:'40%', height:'14px', background:'rgba(0,0,0,.6)',
              border:'2px solid #f66', borderRadius:'7px', display:'none',
              zIndex:'12', overflow:'hidden'
            });

            const fill = document.createElement('div');
            fill.id = 'bossHPFill';
            Object.assign(fill.style, {height:'100%', width:'100%', background:'#ff4876'});

            bar.appendChild(fill);
            root.appendChild(warn);
            root.appendChild(bar);
          }
        }
        ensureBossUI();
        function bossWarn(){ const el=document.getElementById('bossWarning'); if(el){ el.style.display='flex'; setTimeout(()=>el.style.display='none',1800); } }
        function bossUI(pct){
          const bar = document.getElementById('bossHP');
          const fill = document.getElementById('bossHPFill');
          if (!bar || !fill || !gameState.boss){ if(bar) bar.style.display='none'; return; }
          bar.style.display='block';
          fill.style.width = Math.max(0, pct) + '%';
        }

        // ===== Spawn boss đúng 1 lần =====
        function spawnBoss() {
          if (gameState.boss || gameState.bossDead) return;
          bossWarn();
          const dpr = window.devicePixelRatio || 1;
          gameState.boss = {
            type: 'boss',
            x: canvas.width/dpr - (PHASE.boss.width + 40),
            y: canvas.height/dpr/2 - PHASE.boss.height/2,
            width: PHASE.boss.width, height: PHASE.boss.height,
            speed: PHASE.boss.speed, hp: PHASE.boss.hp, lastShot: performance.now()
          };
        }

        // ===== Ghi đè spawnEnemies: gọi bản cũ + đảm bảo boss ở phase 2 =====
        const _spawnEnemies = window.spawnEnemies;
        window.spawnEnemies = function () {
          if (_spawnEnemies) _spawnEnemies();
          if (gameState.phase === 2 && !gameState.boss && !gameState.bossDead) spawnBoss();
        };

        // ===== Ghi đè updateEnemies: cập nhật + vẽ boss + bắn =====
        const _updateEnemies = window.updateEnemies;
        window.updateEnemies = function () {
          if (_updateEnemies) _updateEnemies();

          const b = gameState.boss;
          if (!b) return;

          // move nhẹ theo nhịp
          b.y += Math.sin(performance.now() / 500) * 0.6;
          const dpr = window.devicePixelRatio || 1;
          b.y = Math.max(0, Math.min(canvas.height/dpr - b.height, b.y));

          // draw
          if (images.boss) ctx.drawImage(images.boss, b.x, b.y, b.width, b.height);
          else { ctx.fillStyle = '#ffc107'; ctx.fillRect(b.x, b.y, b.width, b.height); }

          // shoot theo spread3
          const now = performance.now();
          if (now - (b.lastShot || 0) > PHASE.boss.shootDelay) {
            b.lastShot = now;
            enemyShoot(b, { pattern:'spread3', spreadAngle:0.24, speed:9, width:18, height:10, damage:PHASE.boss.bulletDamage });
          }

          bossUI((b.hp / PHASE.boss.hp) * 100);
        };

        // ===== Nâng cấp enemyShoot để nhận cấu hình (không phá code cũ) =====
        const _enemyShoot = window.enemyShoot;
        window.enemyShoot = function (enemy, cfg = {}) {
          if (!_enemyShoot || cfg.pattern) {
            const p = gameState.player;
            const ex = enemy.x, ey = enemy.y + enemy.height / 2;
            const px = p.x + p.width / 2, py = p.y + p.height / 2;
            const angAimed = Math.atan2(py - ey, px - ex);
            const angLeft  = Math.atan2(0, -1); // bắn sang trái là mặc định

            const push = (ang) => {
              const spd = cfg.speed ?? 10;
              const w = cfg.width ?? 15, h = cfg.height ?? 8;
              gameState.enemyProjectiles.push({
                x: ex, y: ey - h/2, width: w, height: h,
                speed: spd, damage: cfg.damage ?? 20,
                vx: Math.cos(ang) * spd * -1, vy: Math.sin(ang) * spd
              });
            };

            switch (cfg.pattern) {
              case 'aimed': push(angAimed); break;
              case 'spread3': {
                const s = cfg.spreadAngle ?? 0.2;
                [angLeft - s, angLeft, angLeft + s].forEach(push);
                break;
              }
              case 'straight':
              default: push(angLeft);
            }
            return;
          }
          return _enemyShoot(enemy);
        };

        // ===== Cho đạn boss có vx/vy chạy song song với hệ cũ =====
        const _updateProjectiles = window.updateProjectiles;

window.updateProjectiles = function () {
  // Gọi hệ cũ (vẽ + xử lý cũ)
  if (typeof _updateProjectiles === "function") _updateProjectiles();

  const dtMul = (gameState.deltaTime || 16) / 16;

  for (let i = gameState.enemyProjectiles.length - 1; i >= 0; i--) {
    const e = gameState.enemyProjectiles[i];

    // Nếu có vx, vy thì cập nhật
    if (typeof e.vx === "number" && typeof e.vy === "number") {
      e.x += e.vx * dtMul;
      e.y += e.vy * dtMul;
    }

    // Xóa đạn nếu ra khỏi màn hình
    if (
      e.x < -100 ||
      e.x > canvas.width + 100 ||
      e.y < -100 ||
      e.y > canvas.height + 100
    ) {
      gameState.enemyProjectiles.splice(i, 1);
      continue;
    }

    // Vẽ đạn
    if (e.img instanceof Image && e.img.complete) {
      ctx.drawImage(e.img, e.x, e.y, e.width, e.height);
    } else {
      ctx.fillStyle = e.color || "#ff0000";
      ctx.fillRect(e.x, e.y, e.width, e.height);
    }
  }
};


        // ===== Điều kiện thắng/đổi phase thống nhất =====
        window.checkVictory = function () {
          if (gameState.phase === 1 && gameState.score >= PHASE.threshold) {
            gameState.phase = 2;
            spawnBoss();
            return; // không end game ở đây
          }
          if (gameState.phase === 2 && gameState.bossDead) {
            if (typeof runWhiteDissolveThenEnding === 'function') runWhiteDissolveThenEnding();
            else if (typeof playVideo2 === 'function') playVideo2();
            else gameOver(true);
          }
        };

        // ===== Gắn damage vào boss + set cờ bossDead =====
        const _checkCollisions = window.checkCollisions;
        window.checkCollisions = function () {
          if (_checkCollisions) _checkCollisions();
          const b = gameState.boss;
          if (!b) return;

          for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
            const proj = gameState.projectiles[i];
            if (proj.x < b.x + b.width && proj.x + proj.width > b.x &&
                proj.y < b.y + b.height && proj.y + proj.height > b.y) {
              b.hp -= proj.damage || 10;
              gameState.projectiles.splice(i, 1);
              if (b.hp <= 0 && !gameState.bossDead) {
                gameState.bossDead = true;
                gameState.boss = null;
              }
            }
          }
        };

        // ===== Khi mở màn battle, resize lại để tránh kéo dãn =====
        const _showBattleStartScreen = window.showBattleStartScreen;
        window.showBattleStartScreen = function () {
          if (_showBattleStartScreen) _showBattleStartScreen();
          if (window._resizeHiDPI) window._resizeHiDPI();
        };
      })();