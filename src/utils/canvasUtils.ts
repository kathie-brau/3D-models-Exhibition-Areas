/**
 * Canvas Utilities for Text Rendering
 * Provides unified canvas text rendering functionality to eliminate code duplication
 */

export interface CanvasBaseConfig {
  backgroundColor: string;
  padding: number;
  borderRadius: number;
  borderColor?: string;
  borderWidth?: number;
  gradient?: { colors: string[]; direction?: 'horizontal' | 'vertical' };
  shadow?: { color: string; blur: number; offsetX: number; offsetY: number };
}

export interface TextConfig extends CanvasBaseConfig {
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  maxWidth?: number;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
}

export interface MultiLineTextConfig extends CanvasBaseConfig {
  lines: string[];
  titleFontSize: number;
  contentFontSize: number;
  fontFamily: string;
  titleColor: string;
  contentColor: string;
  maxWidth?: number;
}

export interface BoothCalloutConfig extends CanvasBaseConfig {
  boothId: string;
  area: string;
  dimensions: string;
  titleFontSize: number;
  contentFontSize: number;
  fontFamily: string;
  titleColor: string;
  contentColor: string;
  areaBoxColor: string;
  maxWidth?: number;
}

interface CanvasDimensions {
  width: number;
  height: number;
}

export class CanvasTextRenderer {
  /**
   * Sets up a canvas with high DPI support and anti-aliasing
   */
  private static setupCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; pixelRatio: number } {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const pixelRatio = window.devicePixelRatio || 1;
    
    // Enable anti-aliasing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    return { canvas, ctx, pixelRatio };
  }

  /**
   * Draws background with gradient support
   */
  private static drawBackground(
    ctx: CanvasRenderingContext2D,
    config: CanvasBaseConfig,
    dimensions: CanvasDimensions,
    pixelRatio: number
  ): void {
    const { backgroundColor, gradient, borderRadius, borderWidth = 0 } = config;
    const scaledBorderWidth = borderWidth * pixelRatio;
    
    ctx.save();
    
    if (gradient) {
      const gradientObj = gradient.direction === 'vertical' 
        ? ctx.createLinearGradient(0, 0, 0, dimensions.height)
        : ctx.createLinearGradient(0, 0, dimensions.width, 0);
      
      gradient.colors.forEach((color, index) => {
        gradientObj.addColorStop(index / (gradient.colors.length - 1), color);
      });
      
      ctx.fillStyle = gradientObj;
    } else {
      ctx.fillStyle = backgroundColor;
    }
    
    // Draw rounded rectangle background
    const radius = borderRadius * pixelRatio;
    ctx.beginPath();
    ctx.roundRect(
      scaledBorderWidth / 2,
      scaledBorderWidth / 2,
      dimensions.width - scaledBorderWidth,
      dimensions.height - scaledBorderWidth,
      radius
    );
    ctx.fill();
    
    ctx.restore();
  }

  /**
   * Draws border if specified
   */
  private static drawBorder(
    ctx: CanvasRenderingContext2D,
    config: CanvasBaseConfig,
    dimensions: CanvasDimensions,
    pixelRatio: number
  ): void {
    const { borderColor, borderWidth = 0, borderRadius } = config;
    
    if (borderColor && borderWidth > 0) {
      const scaledBorderWidth = borderWidth * pixelRatio;
      const radius = borderRadius * pixelRatio;
      
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = scaledBorderWidth;
      
      ctx.beginPath();
      ctx.roundRect(
        scaledBorderWidth / 2,
        scaledBorderWidth / 2,
        dimensions.width - scaledBorderWidth,
        dimensions.height - scaledBorderWidth,
        radius
      );
      ctx.stroke();
    }
  }

  /**
   * Sets up shadow if specified
   */
  private static setupShadow(
    ctx: CanvasRenderingContext2D,
    shadow: NonNullable<CanvasBaseConfig['shadow']>,
    pixelRatio: number
  ): void {
    ctx.shadowColor = shadow.color;
    ctx.shadowBlur = shadow.blur * pixelRatio;
    ctx.shadowOffsetX = shadow.offsetX * pixelRatio;
    ctx.shadowOffsetY = shadow.offsetY * pixelRatio;
  }

  /**
   * Creates a single-line or wrapped text canvas
   */
  public static createTextCanvas(config: TextConfig): HTMLCanvasElement {
    const { canvas, ctx, pixelRatio } = this.setupCanvas();
    
    const {
      text,
      fontSize,
      fontFamily,
      color,
      maxWidth = 400,
      textAlign = 'center',
      lineHeight = 1.2,
      padding,
      borderWidth = 0
    } = config;
    
    // Configure high DPI canvas
    const scaledFontSize = fontSize * pixelRatio;
    const scaledPadding = padding * pixelRatio;
    const scaledBorderWidth = borderWidth * pixelRatio;
    
    // Set font for measuring
    ctx.font = `${scaledFontSize}px ${fontFamily}`;
    
    // Split text into lines if needed
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0] || '';
    
    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + ' ' + words[i];
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth * pixelRatio - scaledPadding * 2) {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
    
    // Calculate canvas dimensions
    let maxTextWidth = 0;
    lines.forEach(line => {
      const metrics = ctx.measureText(line);
      maxTextWidth = Math.max(maxTextWidth, metrics.width);
    });
    
    const textHeight = scaledFontSize * lineHeight;
    const totalTextHeight = textHeight * lines.length;
    
    const canvasWidth = Math.max(maxTextWidth + scaledPadding * 2 + scaledBorderWidth * 2, 64);
    const canvasHeight = Math.max(totalTextHeight + scaledPadding * 2 + scaledBorderWidth * 2, 32);
    
    // Set canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Re-set font after canvas resize
    ctx.font = `${scaledFontSize}px ${fontFamily}`;
    ctx.textAlign = textAlign;
    ctx.textBaseline = 'middle';
    
    // Draw background
    this.drawBackground(ctx, config, { width: canvasWidth, height: canvasHeight }, pixelRatio);
    
    // Draw border
    this.drawBorder(ctx, config, { width: canvasWidth, height: canvasHeight }, pixelRatio);
    
    // Draw shadow if specified
    if (config.shadow) {
      ctx.save();
      this.setupShadow(ctx, config.shadow, pixelRatio);
    }
    
    // Draw text
    ctx.fillStyle = color;
    
    const startY = canvasHeight / 2 - (totalTextHeight / 2) + (textHeight / 2);
    
    lines.forEach((line, index) => {
      const x = textAlign === 'center' ? canvasWidth / 2 : 
               textAlign === 'right' ? canvasWidth - scaledPadding : scaledPadding;
      const y = startY + (index * textHeight);
      
      ctx.fillText(line, x, y);
    });
    
    if (config.shadow) {
      ctx.restore();
    }
    
    return canvas;
  }

  /**
   * Creates a multi-line text canvas with different font sizes for title and content
   */
  public static createMultiLineTextCanvas(config: MultiLineTextConfig): HTMLCanvasElement {
    const { canvas, ctx, pixelRatio } = this.setupCanvas();
    
    const {
      lines,
      titleFontSize,
      contentFontSize,
      fontFamily,
      titleColor,
      contentColor,
      padding,
      borderWidth = 0
    } = config;
    
    // Configure high DPI canvas
    const scaledTitleFontSize = titleFontSize * pixelRatio;
    const scaledContentFontSize = contentFontSize * pixelRatio;
    const scaledPadding = padding * pixelRatio;
    const scaledBorderWidth = borderWidth * pixelRatio;
    
    // Calculate text dimensions
    let maxTextWidth = 0;
    let totalHeight = 0;
    const lineHeights: number[] = [];
    const lineFontSizes: number[] = [];
    
    lines.forEach((line, index) => {
      const isTitle = index === 0; // First line is title
      const fontSize = isTitle ? scaledTitleFontSize : scaledContentFontSize;
      const lineHeight = fontSize * 1.3;
      
      ctx.font = `${isTitle ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
      
      if (line.trim() !== '') {
        const metrics = ctx.measureText(line);
        maxTextWidth = Math.max(maxTextWidth, metrics.width);
        lineHeights.push(lineHeight);
        totalHeight += lineHeight;
      } else {
        // Empty lines for spacing
        lineHeights.push(lineHeight * 0.5);
        totalHeight += lineHeight * 0.5;
      }
      
      lineFontSizes.push(fontSize);
    });
    
    // Canvas dimensions
    const canvasWidth = Math.max(maxTextWidth + scaledPadding * 2 + scaledBorderWidth * 2, 64);
    const canvasHeight = Math.max(totalHeight + scaledPadding * 2 + scaledBorderWidth * 2, 32);
    
    // Set canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Draw background
    this.drawBackground(ctx, config, { width: canvasWidth, height: canvasHeight }, pixelRatio);
    
    // Draw border
    this.drawBorder(ctx, config, { width: canvasWidth, height: canvasHeight }, pixelRatio);
    
    // Draw shadow if specified
    if (config.shadow) {
      ctx.save();
      this.setupShadow(ctx, config.shadow, pixelRatio);
    }
    
    // Draw text lines
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    let currentY = scaledPadding + lineHeights[0] / 2;
    
    lines.forEach((line, index) => {
      if (line.trim() !== '') {
        const isTitle = index === 0;
        const fontSize = lineFontSizes[index];
        
        ctx.font = `${isTitle ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
        ctx.fillStyle = isTitle ? titleColor : contentColor;
        
        const x = canvasWidth / 2;
        ctx.fillText(line, x, currentY);
      }
      
      if (index < lineHeights.length - 1) {
        currentY += lineHeights[index] / 2 + lineHeights[index + 1] / 2;
      }
    });
    
    if (config.shadow) {
      ctx.restore();
    }
    
    return canvas;
  }

  /**
   * Creates a booth callout canvas with area highlight
   */
  public static createBoothCalloutCanvas(config: BoothCalloutConfig): HTMLCanvasElement {
    const { canvas, ctx, pixelRatio } = this.setupCanvas();
    
    const {
      boothId,
      area,
      dimensions,
      titleFontSize,
      contentFontSize,
      fontFamily,
      titleColor,
      contentColor,
      areaBoxColor,
      padding,
      borderRadius,
      borderWidth = 0
    } = config;
    
    // Configure high DPI canvas
    const scaledTitleFontSize = titleFontSize * pixelRatio;
    const scaledContentFontSize = contentFontSize * pixelRatio;
    const scaledPadding = padding * pixelRatio;
    const scaledBorderWidth = borderWidth * pixelRatio;
    
    // Measure text dimensions
    ctx.font = `bold ${scaledTitleFontSize}px ${fontFamily}`;
    const titleMetrics = ctx.measureText(boothId);
    const titleWidth = titleMetrics.width;
    const titleHeight = scaledTitleFontSize * 1.3;
    
    ctx.font = `${scaledContentFontSize}px ${fontFamily}`;
    const areaMetrics = ctx.measureText(area);
    const dimensionsMetrics = ctx.measureText(dimensions);
    
    const areaWidth = areaMetrics.width;
    const dimensionsWidth = dimensionsMetrics.width;
    const contentHeight = scaledContentFontSize * 1.3;
    
    // Calculate layout
    const spacing = scaledPadding * 0.5;
    const areaBoxPadding = scaledPadding * 0.3;
    const maxTextWidth = Math.max(titleWidth, areaWidth + spacing + dimensionsWidth + areaBoxPadding * 2);
    
    // Canvas dimensions
    const canvasWidth = Math.max(maxTextWidth + scaledPadding * 2 + scaledBorderWidth * 2, 64);
    const canvasHeight = Math.max(titleHeight + contentHeight + spacing + scaledPadding * 2 + scaledBorderWidth * 2, 32);
    
    // Set canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Draw background
    this.drawBackground(ctx, config, { width: canvasWidth, height: canvasHeight }, pixelRatio);
    
    // Draw border
    this.drawBorder(ctx, config, { width: canvasWidth, height: canvasHeight }, pixelRatio);
    
    // Draw shadow if specified
    if (config.shadow) {
      ctx.save();
      this.setupShadow(ctx, config.shadow, pixelRatio);
    }
    
    // Draw booth ID (title)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${scaledTitleFontSize}px ${fontFamily}`;
    ctx.fillStyle = titleColor;
    
    const titleY = scaledPadding + titleHeight / 2;
    ctx.fillText(boothId, canvasWidth / 2, titleY);
    
    // Calculate second row layout
    const secondRowY = titleY + titleHeight / 2 + spacing + contentHeight / 2;
    
    // Draw area in lighter box
    const areaBoxWidth = areaWidth + areaBoxPadding * 2;
    const areaBoxHeight = contentHeight + areaBoxPadding;
    const areaBoxX = canvasWidth / 2 - (areaBoxWidth + spacing + dimensionsWidth) / 2;
    const areaBoxY = secondRowY - areaBoxHeight / 2;
    
    ctx.fillStyle = areaBoxColor;
    ctx.beginPath();
    ctx.roundRect(areaBoxX, areaBoxY, areaBoxWidth, areaBoxHeight, borderRadius * pixelRatio * 0.5);
    ctx.fill();
    
    // Draw area text
    ctx.font = `${scaledContentFontSize}px ${fontFamily}`;
    ctx.fillStyle = contentColor;
    ctx.fillText(area, areaBoxX + areaBoxWidth / 2, secondRowY);
    
    // Draw dimensions text
    const dimensionsX = areaBoxX + areaBoxWidth + spacing + dimensionsWidth / 2;
    ctx.fillText(dimensions, dimensionsX, secondRowY);
    
    if (config.shadow) {
      ctx.restore();
    }
    
    return canvas;
  }
}