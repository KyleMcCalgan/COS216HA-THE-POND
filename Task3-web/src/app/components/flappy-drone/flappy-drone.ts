import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-flappy-drone',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flappy-drone.html',
  styleUrls: ['./flappy-drone.css']
})
export class FlappyDrone implements OnInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private ctx!: CanvasRenderingContext2D;
  private gameLoop!: number;
  private lastTime = 0;
  
  // Game state
  gameState: 'menu' | 'playing' | 'gameOver' = 'menu';
  score = 0;
  highScore = 0;
  
  // Canvas dimensions
  private readonly CANVAS_WIDTH = 800;
  private readonly CANVAS_HEIGHT = 600;
  
  // Drone properties
  private drone = {
    x: 150,
    y: 300,
    width: 40,
    height: 30,
    velocity: 0,
    gravity: 0.4,        // Reduced from 0.6 to 0.4 (less falling speed)
    jumpStrength: -9,    // Reduced from -12 to -9 (less jump power)
    rotation: 0
  };
  
  // Buildings (obstacles)
  private buildings: Array<{
    x: number;
    topHeight: number;
    bottomHeight: number;
    width: number;
    passed: boolean;
  }> = [];
  
  private readonly BUILDING_WIDTH = 80;
  private readonly BUILDING_GAP = 250;    // Increased from 200 to 250 (bigger gap)
  private readonly BUILDING_SPEED = 2;    // Reduced from 3 to 2 (slower movement)
  private readonly BUILDING_SPACING = 350; // Increased from 300 to 350 (more space between buildings)
  
  // Particles for effects
  private particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    color: string;
  }> = [];
  
  // Background elements
  private clouds: Array<{
    x: number;
    y: number;
    size: number;
    speed: number;
  }> = [];

  constructor(private router: Router) {}

  ngOnInit() {
    this.initGame();
    this.loadHighScore();
    this.generateClouds();
  }

  ngOnDestroy() {
    if (this.gameLoop) {
      cancelAnimationFrame(this.gameLoop);
    }
  }

  private initGame() {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = this.CANVAS_WIDTH;
    canvas.height = this.CANVAS_HEIGHT;
    this.ctx = canvas.getContext('2d')!;
    
    this.resetGame();
    this.gameLoop = requestAnimationFrame((time) => this.update(time));
  }

  private resetGame() {
    this.drone.x = 150;
    this.drone.y = 300;
    this.drone.velocity = 0;
    this.drone.rotation = 0;
    this.buildings = [];
    this.particles = [];
    this.score = 0;
    
    // Generate initial buildings
    for (let i = 0; i < 3; i++) {
      this.generateBuilding(this.CANVAS_WIDTH + i * this.BUILDING_SPACING);
    }
  }

  private generateBuilding(x: number) {
    const minTopHeight = 80;    // Reduced from 100 to 80 (shorter minimum building)
    const maxTopHeight = this.CANVAS_HEIGHT - this.BUILDING_GAP - 80; // Reduced from 100 to 80
    const topHeight = Math.random() * (maxTopHeight - minTopHeight) + minTopHeight;
    const bottomHeight = this.CANVAS_HEIGHT - topHeight - this.BUILDING_GAP;
    
    this.buildings.push({
      x,
      topHeight,
      bottomHeight,
      width: this.BUILDING_WIDTH,
      passed: false
    });
  }

  private generateClouds() {
    for (let i = 0; i < 8; i++) {
      this.clouds.push({
        x: Math.random() * this.CANVAS_WIDTH,
        y: Math.random() * (this.CANVAS_HEIGHT * 0.4),
        size: Math.random() * 30 + 20,
        speed: Math.random() * 0.5 + 0.2
      });
    }
  }

  private update(currentTime: number) {
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    this.ctx.clearRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
    
    this.drawBackground();
    this.drawClouds();
    
    if (this.gameState === 'playing') {
      this.updateDrone();
      this.updateBuildings();
      this.updateParticles();
      this.checkCollisions();
      this.checkScore();
    }
    
    this.drawBuildings();
    this.drawDrone();
    this.drawParticles();
    this.drawUI();
    
    this.gameLoop = requestAnimationFrame((time) => this.update(time));
  }

  private updateDrone() {
    // Apply gravity
    this.drone.velocity += this.drone.gravity;
    this.drone.y += this.drone.velocity;
    
    // Update rotation based on velocity (less dramatic rotation)
    this.drone.rotation = Math.min(Math.max(this.drone.velocity * 2, -20), 60); // Reduced rotation range
    
    // Keep drone in bounds
    if (this.drone.y < 0) {
      this.drone.y = 0;
      this.drone.velocity = 0;
    }
    if (this.drone.y > this.CANVAS_HEIGHT - this.drone.height) {
      this.gameOver();
    }
  }

  private updateBuildings() {
    // Move buildings
    for (let building of this.buildings) {
      building.x -= this.BUILDING_SPEED;
    }
    
    // Remove buildings that are off screen and add new ones
    this.buildings = this.buildings.filter(building => building.x + building.width > -50);
    
    if (this.buildings.length > 0) {
      const lastBuilding = this.buildings[this.buildings.length - 1];
      if (lastBuilding.x < this.CANVAS_WIDTH - this.BUILDING_SPACING) {
        this.generateBuilding(lastBuilding.x + this.BUILDING_SPACING);
      }
    }
  }

  private updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.2; // Gravity for particles
      particle.life--;
      
      if (particle.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private checkCollisions() {
    for (let building of this.buildings) {
      // Check collision with top building (with slight margin for forgiveness)
      if (this.drone.x + 5 < building.x + building.width &&
          this.drone.x + this.drone.width - 5 > building.x &&
          this.drone.y + 5 < building.topHeight) {
        this.gameOver();
        return;
      }
      
      // Check collision with bottom building (with slight margin for forgiveness)
      if (this.drone.x + 5 < building.x + building.width &&
          this.drone.x + this.drone.width - 5 > building.x &&
          this.drone.y + this.drone.height - 5 > this.CANVAS_HEIGHT - building.bottomHeight) {
        this.gameOver();
        return;
      }
    }
  }

  private checkScore() {
    for (let building of this.buildings) {
      if (!building.passed && building.x + building.width < this.drone.x) {
        building.passed = true;
        this.score++;
        this.createScoreEffect();
      }
    }
  }

  private createScoreEffect() {
    // Create particles for scoring
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x: this.drone.x + this.drone.width / 2,
        y: this.drone.y + this.drone.height / 2,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 30,
        maxLife: 30,
        size: Math.random() * 3 + 2,
        color: '#4CAF50'
      });
    }
  }

  private createCrashEffect() {
    // Create particles for crashing
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x: this.drone.x + this.drone.width / 2,
        y: this.drone.y + this.drone.height / 2,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        life: 40,
        maxLife: 40,
        size: Math.random() * 4 + 2,
        color: '#FF5722'
      });
    }
  }

  private drawBackground() {
    // Sky gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.CANVAS_HEIGHT);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#98D8E8');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
  }

  private drawClouds() {
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let cloud of this.clouds) {
      // Move clouds
      cloud.x -= cloud.speed;
      if (cloud.x < -cloud.size) {
        cloud.x = this.CANVAS_WIDTH + cloud.size;
      }
      
      // Draw cloud (simple circles)
      this.ctx.beginPath();
      this.ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
      this.ctx.arc(cloud.x + cloud.size * 0.5, cloud.y, cloud.size * 0.8, 0, Math.PI * 2);
      this.ctx.arc(cloud.x - cloud.size * 0.5, cloud.y, cloud.size * 0.8, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawDrone() {
    this.ctx.save();
    this.ctx.translate(this.drone.x + this.drone.width / 2, this.drone.y + this.drone.height / 2);
    this.ctx.rotate((this.drone.rotation * Math.PI) / 180);
    
    // Draw drone body
    this.ctx.fillStyle = '#2196F3';
    this.ctx.fillRect(-this.drone.width / 2, -this.drone.height / 2, this.drone.width, this.drone.height);
    
    // Draw propellers
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(-this.drone.width / 2 - 5, -this.drone.height / 2);
    this.ctx.lineTo(-this.drone.width / 2 + 5, -this.drone.height / 2);
    this.ctx.moveTo(this.drone.width / 2 - 5, -this.drone.height / 2);
    this.ctx.lineTo(this.drone.width / 2 + 5, -this.drone.height / 2);
    this.ctx.stroke();
    
    // Draw center light
    this.ctx.fillStyle = '#4CAF50';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 3, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.restore();
  }

  private drawBuildings() {
    this.ctx.fillStyle = '#424242';
    this.ctx.strokeStyle = '#212121';
    this.ctx.lineWidth = 2;
    
    for (let building of this.buildings) {
      // Draw top building
      this.ctx.fillRect(building.x, 0, building.width, building.topHeight);
      this.ctx.strokeRect(building.x, 0, building.width, building.topHeight);
      
      // Draw windows on top building
      this.drawBuildingWindows(building.x, 0, building.width, building.topHeight);
      
      // Draw bottom building
      const bottomY = this.CANVAS_HEIGHT - building.bottomHeight;
      this.ctx.fillRect(building.x, bottomY, building.width, building.bottomHeight);
      this.ctx.strokeRect(building.x, bottomY, building.width, building.bottomHeight);
      
      // Draw windows on bottom building
      this.drawBuildingWindows(building.x, bottomY, building.width, building.bottomHeight);
    }
  }

  private drawBuildingWindows(x: number, y: number, width: number, height: number) {
    this.ctx.fillStyle = '#FFEB3B';
    const windowWidth = 8;
    const windowHeight = 12;
    const spacing = 15;
    
    for (let i = x + 10; i < x + width - windowWidth; i += spacing) {
      for (let j = y + 15; j < y + height - windowHeight; j += spacing) {
        if (Math.random() > 0.3) { // Not all windows are lit
          this.ctx.fillRect(i, j, windowWidth, windowHeight);
        }
      }
    }
  }

  private drawParticles() {
    for (let particle of this.particles) {
      const alpha = particle.life / particle.maxLife;
      this.ctx.fillStyle = particle.color;
      this.ctx.globalAlpha = alpha;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
  }

  private drawUI() {
    // Score
    this.ctx.fillStyle = '#333';
    this.ctx.font = 'bold 36px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(this.score.toString(), this.CANVAS_WIDTH / 2, 60);
    
    // Menu screen
    if (this.gameState === 'menu') {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
      
      this.ctx.fillStyle = '#FFF';
      this.ctx.font = 'bold 48px Arial';
      this.ctx.fillText('FLAPPY DRONE', this.CANVAS_WIDTH / 2, 200);
      
      this.ctx.font = '24px Arial';
      this.ctx.fillText('Click or Press SPACE to Start', this.CANVAS_WIDTH / 2, 300);
      this.ctx.fillText('Navigate through the buildings!', this.CANVAS_WIDTH / 2, 340);
      this.ctx.fillText('(Updated: Easier difficulty)', this.CANVAS_WIDTH / 2, 380);
      
      if (this.highScore > 0) {
        this.ctx.fillText(`Best Score: ${this.highScore}`, this.CANVAS_WIDTH / 2, 430);
      }
    }
    
    // Game over screen
    if (this.gameState === 'gameOver') {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
      
      this.ctx.fillStyle = '#FFF';
      this.ctx.font = 'bold 48px Arial';
      this.ctx.fillText('GAME OVER', this.CANVAS_WIDTH / 2, 200);
      
      this.ctx.font = '28px Arial';
      this.ctx.fillText(`Score: ${this.score}`, this.CANVAS_WIDTH / 2, 280);
      this.ctx.fillText(`Best: ${this.highScore}`, this.CANVAS_WIDTH / 2, 320);
      
      this.ctx.font = '20px Arial';
      this.ctx.fillText('Click or Press SPACE to Restart', this.CANVAS_WIDTH / 2, 380);
      this.ctx.fillText('ESC to Return to Dashboard', this.CANVAS_WIDTH / 2, 410);
    }
  }

  private startGame() {
    this.gameState = 'playing';
    this.resetGame();
  }

  private gameOver() {
    this.gameState = 'gameOver';
    this.createCrashEffect();
    
    // Update high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
    }
  }

  private jump() {
    if (this.gameState === 'playing') {
      this.drone.velocity = this.drone.jumpStrength;
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    switch (event.code) {
      case 'Space':
        event.preventDefault();
        if (this.gameState === 'menu' || this.gameState === 'gameOver') {
          this.startGame();
        } else if (this.gameState === 'playing') {
          this.jump();
        }
        break;
      case 'Escape':
        this.returnToDashboard();
        break;
    }
  }

  @HostListener('click')
  handleClick() {
    if (this.gameState === 'menu' || this.gameState === 'gameOver') {
      this.startGame();
    } else if (this.gameState === 'playing') {
      this.jump();
    }
  }

  private saveHighScore() {
    localStorage.setItem('flappyDroneHighScore', this.highScore.toString());
  }

  private loadHighScore() {
    const saved = localStorage.getItem('flappyDroneHighScore');
    this.highScore = saved ? parseInt(saved) : 0;
  }

  returnToDashboard() {
    this.router.navigate(['/customer']);
  }
}