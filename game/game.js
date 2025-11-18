// game.js

/**
 * メインのゲームシーン
 */
class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        
        // --- 変数の初期化 ---
        this.playerCat = null;
        this.cursors = null;
        this.spaceKey = null;
        this.bullets = null;
        this.targets = null;
        this.explosions = null;
        
        this.playerSpeed = 350;
        this.bulletSpeed = -500;
        
        // --- スコア関連 ---
        this.score = 0;
        this.scoreText = null;
        
        this.highScore = 0;      // ★ ハイスコアを保持する変数
        this.highScoreText = null; // ★ ハイスコア表示用テキスト
        
        // --- ダウン＆復帰関連 ---
        this.isDown = false;
        this.reviveText = null;
        this.mashCount = 0;
//        this.mashToRevive = 10;

        this.requiredPresses = 1; // ★ 復帰に必要な回数 (初期値 1)
        this.pressIncrement = 1;  // ★ 1回復帰するごとに増える回数 (例: 2回ずつ増やす)
        // (1回目:1, 2回目:3, 3回目:5, 4回目:7 ... と難しくなる)
        
        this.reviveTimer = null;   // ★ 復帰タイマーを入れる変数
        this.gameOverText = null;  // ★ ゲームオーバーテキスト用
        this.targetTimer = null;   // ★ 敵の出現タイマー用
        
        // ★ターゲットのHPと色定義
        this.targetMaxHP = 3; // ターゲットを破壊するのに必要なヒット回数
        this.targetColors = [ // [HP1の色, HP2の色, HP3の色]
            0xff0000, // HP1 (赤)
            0xffff00, // HP2 (黄)
            0x00ff00  // HP3 (初期 - 緑)
        ];
        this.targetImageKey = 'target'; // 使用するターゲットの画像キー
    }

    preload() {
        // 画像を読み込む
//        this.load.image('playerCat', 'assets/playerCat.png');
        this.load.spritesheet('playerAnim', 'assets/playerCatAnime.png', { 
            frameWidth: 64, 
            frameHeight: 64 
        });
        this.load.image('bullet', 'assets/bullet.png');
        this.load.image('target', 'assets/target.png');
        this.load.image('explosionParticle', 'assets/sparkle.png');
        
        // ★ 背景画像を読み込む
        // 'background' というキー名で 'assets/background.png' を読み込み
        this.load.image('background', 'assets/background.png');
        
        
    }

    create() {
        // --- 0. 変数の初期化 (リスタート対応) ---
        // ゲームがリスタートするたびに、ここが実行されて変数がリセットされます
        this.score = 0;
        this.isDown = false;
        this.mashCount = 0;
        this.requiredPresses = 3; // 難易度もリセット
        
        // 残っているタイマーがあれば削除
        if (this.reviveTimer) this.reviveTimer.remove();
        this.reviveTimer = null;
        
        
        // ★ 背景画像を配置する (他のゲームオブジェクトより先に配置すること！)
        // this.add.image(X座標, Y座標, '画像キー');
        // 画面の中心に画像を配置すると、画像も中心を基準に描画されるので、
        // 画面いっぱいに広がりやすくなります。
        const backgroundImage = this.add.image(400, 300, 'background');

        // 背景画像がゲーム画面のサイズと合わない場合、拡大・縮小して合わせる
        // width: 800, height: 600 のゲーム画面を想定
        backgroundImage.displayWidth = this.sys.game.config.width;    // ゲーム画面の幅に合わせる
        backgroundImage.displayHeight = this.sys.game.config.height;  // ゲーム画面の高さに合わせる
        
        // ★★★ 1. アニメーションを登録する (このコードを追加) ★★★
        // ゲーム開始時に「こういうアニメーションがあるよ」とPhaserに教えます。
        this.anims.create({
            key: 'player_idle', // アニメーションの名前 (例: '待機中')
            frames: this.anims.generateFrameNumbers('playerAnim', { start: 0, end: 1 }), // 0, 1, 2のコマを使う
            frameRate: 4,  // 1秒間に10コマ (速度)
            repeat: -1      // -1 で無限ループ
        });
        
        this.anims.create({
            key: 'player_down', // アニメーションの名前 (例: 'ダウン中')
            frames: this.anims.generateFrameNumbers('playerAnim', { start: 2, end: 2 }), // 例: コマ3だけを使う
            frameRate: 1,  // ほぼ静止画なのでフレームレートは低く
            repeat: -1     // -1 で無限ループ（ひっくり返ったまま固定）
        });
        
        // --- 1. プレイヤー（猫）の作成 ---
        this.playerCat = this.physics.add.sprite(400, 550, 'playerAnim')
            .setDisplaySize(80, 80)
            .setCollideWorldBounds(true);
            
        this.playerCat.body.setImmovable(true);
        
        // 当たり判定のサイズを、見た目(50x50)より小さい 30x30 に設定
        this.playerCat.body.setSize(30, 30); 
        // (必要に応じてオフセットも調整できます → player.body.setOffset(x, y))
        
        // ★ 登録した 'player_idle' アニメーションを再生！
        this.playerCat.play('player_idle');

        // --- 2. 操作（キー入力）の設定 ---
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.input.keyboard.on('keydown', this.handleMash, this);

        // --- 3. グループの作成 ---
        this.bullets = this.physics.add.group();
        this.targets = this.physics.add.group();
        this.explosions = this.physics.add.group();

        // --- 4. 弾の発射 ---
        this.spaceKey.on('down', this.fireBullet, this);

        // --- 5. ターゲットの生成 ---
        this.targetTimer = this.time.addEvent({
            delay: 1500,
            callback: this.spawnTarget,
            callbackScope: this,
            loop: true
        });

        // --- 6. 当たり判定の設定 ---
        this.physics.add.collider(this.bullets, this.targets, this.hitBulletToTarget, null, this);
        this.physics.add.collider(this.explosions, this.targets, this.hitExplosionToTarget, null, this);
        this.physics.add.collider(this.playerCat, this.targets, this.hitPlayer, null, this);
//        this.physics.add.collider(this.playerCat, this.explosions, this.hitPlayer, null, this);
        
        // --- 7. UI（スコア・復帰テキスト）の作成 ---
        this.scoreText = this.add.text(16, 16, 'Score: 0', {
            fontFamily: '"DotGothic16", sans-serif',
            fontSize: '24px',
            fill: '#000000'
            
            
            
        });
        
        // --- 7B. ハイスコアの読み込みと表示 ---
        // localStorageから 'nyankoHighScore' という名前で保存された値を取得
        const storedHighScore = localStorage.getItem('nyankoHighScore');
        
        // 保存された値があれば、それをハイスコアとして採用
        if (storedHighScore) {
            this.highScore = parseInt(storedHighScore, 10); // 文字列を数値に変換
        } else {
            this.highScore = 0; // なければ0
        }

        // ハイスコアを画面に表示 (スコアの下など)
        this.highScoreText = this.add.text(16, 44, 'High Score: ' + this.highScore, { // ★ Y座標を調整
            fontFamily: 'sans-serif',
            fontSize: '20px', // 少し小さめに
            fill: '#888888'   // 少し薄い色に
        });
        
        this.reviveText = this.add.text(400, 300, '連打して復帰！', {
            fontFamily: '"DotGothic16", sans-serif',
            fontSize: '48px',
            fill: '#FF0000',
            stroke: '#FFFFFF',
            strokeThickness: 6
           
        }).setOrigin(0.5).setVisible(false);
        
        this.gameOverText = this.add.text(400, 300, 'GAME OVER\n(クリックでリスタート)', {
            fontFamily: '"DotGothic16", sans-serif',
            fontSize: '48px',
            fill: '#FF0000',
            align: 'center',
            stroke: '#FFFFFF',
            strokeThickness: 6
        }).setOrigin(0.5).setVisible(false);
    }

    update() {
        if (this.isDown) {
            this.playerCat.setVelocityX(0);
            return;
        }
        
        if (this.cursors.left.isDown) {
            this.playerCat.setVelocityX(-this.playerSpeed);
        } else if (this.cursors.right.isDown) {
            this.playerCat.setVelocityX(this.playerSpeed);
        } else {
            this.playerCat.setVelocityX(0);
        }
        
        // 画面外（下）に落ちたターゲットを削除
        this.targets.children.each(t => {
            if (t && t.y > 600) {
                t.destroy();
            }
        });
        // 画面外（上）に出た弾を削除
        this.bullets.children.each(b => {
            if (b && b.y < 0) b.destroy();
        });
    }

    /**
     * 弾を発射する
     */
    fireBullet() {
        if (this.isDown) return;

        const bullet = this.bullets.create(this.playerCat.x, this.playerCat.y - 30, 'bullet')
            .setDisplaySize(40, 40);

        if (bullet) {
            bullet.setVelocityY(this.bulletSpeed);
            
            // この弾はグローバル重力の影響を受けないようにする
            bullet.body.allowGravity = false;
            
            // ★★★ この行を追加 ★★★
            // 見た目(20x20)より当たり判定を大きくする (例: 30x30)
            // これで敵に当たりやすくなります！
            bullet.body.setSize(30, 30);
        }
    }

    /**
     * ★ ターゲット（カブトムシの甲羅）を生成する関数
     */
    spawnTarget() {
        if (this.isDown) return;

        const x = Phaser.Math.Between(50, 750); // 開始位置
        const target = this.targets.create(x, 0, this.targetImageKey)
            .setDisplaySize(80, 80);

        if (target) {
            // ★ X方向の初速をランダムに設定 (左右どちらかへ 50～150 の速度)
            const speedX = Phaser.Math.Between(50, 150) * (Math.random() < 0.5 ? 1 : -1);
            // ★ Y方向の初速 (下方向へ 100～150 の速度)
            const speedY = Phaser.Math.Between(100, 150); 
            
            target.setVelocity(speedX, speedY); // XとYの速度をセット

            // ★ 画面の端で跳ね返る設定
            target.setCollideWorldBounds(true); // 画面端に衝突
            target.setBounce(1); // 反発係数を1（速度維持）に設定
            
            // ★★★ この行を追加 ★★★
            // 見た目(50x50)より当たり判定を小さくする (例: 40x40)
            // これでキュウリの端をすり抜けやすくなります。
            target.body.setSize(30, 30);

            // ★ 初期HPと色
            target.setData('hp', this.targetMaxHP); // 初期HPを設定
            this.updateTargetColor(target); // 初期色を設定
        }
    }
    
    /**
     * ★ メインの弾がターゲットに当たった
     */
    hitBulletToTarget(bullet, target) {
        bullet.destroy(); // 弾は消す
        this.damageTarget(target); // ターゲットにダメージを与える
    }

    /**
     * ★ 爆発（破片）がターゲットに当たった（＝連鎖）
     */
    hitExplosionToTarget(explosion, target) {
        explosion.destroy(); // 破片は消す
        this.damageTarget(target); // ターゲットにダメージを与える
    }
    
    /**
     * ★ ターゲットにダメージを与える（HP制の中心）
     */
    damageTarget(target) {
        if (!target.active) return; // 既に処理中なら何もしない

        // HPを1減らす
        let currentHp = target.getData('hp');
        currentHp--;
        target.setData('hp', currentHp);

        if (currentHp > 0) {
            // HPが残っている場合: 色を変える
            this.updateTargetColor(target);
        } else {
            // HPが0になった場合: 爆発させる
            this.explodeTarget(target);
        }
    }

    /**
     * ★ HPに応じてターゲットの色を変更する
     */
    updateTargetColor(target) {
        if (!target.active) return;
        
        const hp = target.getData('hp');
        // HPが1なら配列[0]、HP2なら配列[1]...
        const color = this.targetColors[hp - 1]; 
        
        if (color) {
            target.setTint(color);
        } else {
            target.clearTint(); // HPが範囲外なら色をリセット
        }
    }

    /**
     * ★ ターゲットを爆発させる（連鎖処理の中心）
     */
    explodeTarget(target) {
        if (!target.active) return;

        const targetX = target.x;
        const targetY = target.y;
        
        target.destroy(); // ターゲット本体を消す

        // --- スコア加算 ---
        // TODO: ここで連鎖数(combo)に応じたスコア計算を入れる
        this.score += 50; // HP制にしたので得点をアップ
        this.scoreText.setText('Score: ' + this.score);

        // --- 破片（爆発エフェクト）を生成 ---
        const particleCount = Phaser.Math.Between(4, 8);
        
        for (let i = 0; i < particleCount; i++) {
            const explosion = this.explosions.create(targetX, targetY, 'explosionParticle')
                .setDisplaySize(50, 50)
                .setTint(0xffff00); // キラキラ感

            if (explosion) {
                // ★★★ この行を追加 ★★★
                // 見た目(15x15)より当たり判定を大きくする (例: 25x25)
                // これで連鎖が起こりやすくなります！
                explosion.body.setSize(30, 30);
                
                const vecX = Phaser.Math.Between(-200, 200);
                const vecY = Phaser.Math.Between(-200, 200);
                explosion.setVelocity(vecX, vecY);
                
                // 破片は0.5秒後に自動で消える
                this.time.addEvent({
                    delay: 1000,
                    callback: () => {
                        if (explosion) explosion.destroy();
                    }
                });
            }
        }
    }

    /**
     * ★ プレイヤーが被弾した
     */
    hitPlayer(player, hazard) {
        if (this.isDown) return;

        hazard.destroy();
        
        this.isDown = true;
        this.physics.pause();
        this.playerCat.setTint(0xff9999); // ダメージ色
        
        // ★★★ ここに被弾アニメーション再生を追加 ★★★
        this.playerCat.play('player_down'); // 'player_down' アニメーションを再生
        
//        this.reviveText.setVisible(true);
        this.mashCount = 0;
        this.reviveText
            .setText(`連打！ (${this.mashCount}/${this.requiredPresses})`) // ★ カウンター表示
            .setVisible(true);
    
    if (this.reviveTimer) this.reviveTimer.remove();
        
        // 3秒後 (3000ms) に handleGameOver 関数を呼ぶタイマーをセット
        this.reviveTimer = this.time.addEvent({
            delay: 3000,
            callback: this.handleGameOver,
            callbackScope: this
        });
    }
    
    /**
     * ★ キー連打による復帰処理
     */
    handleMash(event) {
        if (!this.isDown) return;

        this.mashCount++;
        this.reviveText.setText(`連打！ (${this.mashCount}/${this.requiredPresses})`);

        // チェックする変数を変更
        if (this.mashCount >= this.requiredPresses) {
            // --- 復帰成功 ---
            this.isDown = false;
            this.physics.resume();
            this.playerCat.clearTint();
            this.reviveText.setVisible(false);
            this.playerCat.play('player_idle');

            // ★ 変更点 (ここから)
            // 成功したので、ゲームオーバータイマーを削除
            if (this.reviveTimer) this.reviveTimer.remove();
            this.reviveTimer = null;
            // ★ 変更点 (ここまで)

            // 次回の復帰に必要な回数を増やす
            this.requiredPresses += this.pressIncrement; 
        }
    }
    
    /**
     * ★ 復帰タイマーが時間切れになった時の処理 (新しく追加)
     */
    handleGameOver() {
        // プレイヤーがまだダウンしているか確認
        // (ギリギリで復帰していたら isDown が false になっているので何もしない)
        if (!this.isDown) {
            return; 
        }

        // --- ゲームオーバー処理 ---
        this.isDown = true; // 念のため
        this.physics.pause();
        this.reviveText.setVisible(false);
        this.gameOverText.setVisible(true);
        this.playerCat.setActive(false).setVisible(false); // 猫を消す

        // 敵の出現タイマーを止める
        if (this.targetTimer) this.targetTimer.paused = true;
        
        // --- ハイスコアのチェックと保存 ---
        if (this.score > this.highScore) {
            this.highScore = this.score; // ハイスコアを更新
            
            // localStorage に 'nyankoHighScore' という名前で保存
            localStorage.setItem('nyankoHighScore', this.highScore);
            
            // ハイスコア表示を更新
            this.highScoreText.setText('High Score: ' + this.highScore);
            
            // (おまけ) ゲームオーバーの文字も変える
            this.gameOverText.setText('NEW RECORD!\n' + this.score + '点\n(クリックでリスタート)');
        }

        // ★ リスタート機能
        // 画面をクリックしたら、リスタートする
        this.input.once('pointerdown', () => {
            this.scene.restart();
        });
    }
}


// --- ゲーム全体の設定 ---
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 593,
    parent: 'game-container',
    backgroundColor: '#f0f0f0', // 背景色を白っぽく
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 }, // ★重力はナシ（ピンポン玉のように跳ね返る）
            debug: false
        }
    },
    scene: [GameScene]
};

// --- ゲームの起動 ---
const game = new Phaser.Game(config);