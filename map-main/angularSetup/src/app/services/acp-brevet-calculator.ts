/**
 * ACPBrevetCalculator
 * 
 * This class calculates the opening and closing times for controls
 * in an ACP (Audax Club Parisien) brevet based on official rules.
 * 
 * Example usage:
 * 
 * ```typescript
 * // Create a calculator for a 600km brevet starting at 8am on March 15, 2025
 * const calculator = new ACPBrevetCalculator(600, '2025-03-15 08:00:00');
 * 
 * // Get the brevet's overall time limits
 * const limits = calculator.getBrevetTimeLimits();
 * console.log(`Brevet distance: ${limits.distance}km (official: ${limits.officialDistance}km)`);
 * console.log(`Minimum completion time: ${limits.minTime} (${limits.minDatetime.toISOString()})`);
 * console.log(`Maximum completion time: ${limits.maxTime} (${limits.maxDatetime.toISOString()})`);
 * 
 * // You can also access these methods individually
 * const minHours = calculator.getMinimumCompletionTime();
 * const maxHours = calculator.getMaximumCompletionTime();
 * console.log(`Fastest allowed time: ${calculator.formatTime(minHours)}`);
 * console.log(`Time limit: ${calculator.formatTime(maxHours)}`);
 * ```
 */

export interface SpeedLimit {
    start: number;
    end: number;
    min: number;
    max: number;
  }
  
  export interface ControlTime {
    distance: number;
    openingHours: number;
    openingTime: string;
    openingDatetime: Date;
    closingHours: number;
    closingTime: string;
    closingDatetime: Date;
  }
  
  export interface BrevetTimeLimits {
    distance: number;
    officialDistance: number;
    minHours: number;
    minTime: string;
    minDatetime: Date;
    maxHours: number;
    maxTime: string;
    maxDatetime: Date;
  }
  
  export class ACPBrevetCalculator {
    /**
     * Speed limits for different segments of a brevet
     */
    private speedLimits: SpeedLimit[] = [
      {
        start: 0,
        end: 200,
        min: 15,
        max: 34
      },
      {
        start: 200,
        end: 400,
        min: 15,
        max: 32
      },
      {
        start: 400,
        end: 600,
        min: 15,
        max: 30
      },
      {
        start: 600,
        end: 1000,
        min: 11.428,
        max: 28
      },
      {
        start: 1000,
        end: 1300,
        min: 13.333,
        max: 26
      }
    ];
  
    /**
     * Official time limits for standard brevets in hours
     */
    private officialTimeLimits: Record<number, number> = {
      200: 13.5,  // 13h30
      300: 20,    // 20h00
      400: 27,    // 27h00
      600: 40,    // 40h00
      1000: 75,   // 75h00
      1200: 90    // 90h00
    };
  
    /**
     * Total brevet distance in kilometers
     */
    private brevetDistance: number;
  
    /**
     * Official brevet distance (200, 300, 400, 600, 1000, 1200)
     */
    private officialDistance: number;
  
    /**
     * Start time of the brevet
     */
    private startTime: Date;
  
    /**
     * Constructor
     * 
     * @param distance Total brevet distance in kilometers
     * @param startTime Start time as string or Date object (defaults to now)
     */
    constructor(distance: number, startTime: string | Date = new Date()) {
      // Convert to kilometers and truncate to nearest kilometer
      this.brevetDistance = Math.floor(distance);
  
      // Set start time
      this.startTime = startTime instanceof Date ? startTime : new Date(startTime);
  
      // Determine official brevet distance
      this.officialDistance = this.setOfficialDistance();
    }
  
    /**
     * Set the official brevet distance based on the actual route length
     */
    private setOfficialDistance(): number {
      const standardDistances = [200, 300, 400, 600, 1000, 1200];
  
      for (const distance of standardDistances) {
        if (this.brevetDistance <= distance * 1.05) {
          return distance;
        }
      }
  
      // If we get here, it's longer than a standard brevet
      return this.brevetDistance;
    }
  
    /**
     * Calculate opening time for a control
     * 
     * @param controlDistance Distance of the control in kilometers
     * @return Time in hours
     */
    public calculateOpeningTime(controlDistance: number): number {
      // Truncate to nearest kilometer
      controlDistance = Math.floor(controlDistance);
  
      // Cap the control distance at the official distance for final control
      if (controlDistance > this.officialDistance) {
        controlDistance = this.officialDistance;
      }
  
      let openingTime = 0;
      let remainingDistance = controlDistance;
  
      for (const limit of this.speedLimits) {
        if (remainingDistance <= 0) {
          break;
        }
  
        const segmentDistance = Math.min(remainingDistance, limit.end - limit.start);
  
        if (segmentDistance > 0) {
          openingTime += segmentDistance / limit.max;
          remainingDistance -= segmentDistance;
        }
      }
  
      return openingTime;
    }
  
    /**
     * Calculate closing time for a control
     * 
     * @param controlDistance Distance of the control in kilometers
     * @return Time in hours
     */
    public calculateClosingTime(controlDistance: number): number {
      // Truncate to nearest kilometer
      controlDistance = Math.floor(controlDistance);
  
      // Special case for controls within 60km from start
      if (controlDistance < 60) {
        // Relaxed closing times for early controls
        // 60km at 20km/h = 3 hours instead of 4 hours (at 15km/h)
        return controlDistance / 20;
      }
  
      // Cap the control distance at the official distance for final control
      if (controlDistance > this.officialDistance) {
        controlDistance = this.officialDistance;
      }
  
      let closingTime = 0;
      let remainingDistance = controlDistance;
  
      for (const limit of this.speedLimits) {
        if (remainingDistance <= 0) {
          break;
        }
  
        const segmentDistance = Math.min(remainingDistance, limit.end - limit.start);
  
        if (segmentDistance > 0) {
          closingTime += segmentDistance / limit.min;
          remainingDistance -= segmentDistance;
        }
      }
  
      // Apply official time limits for standard brevets
      if (controlDistance >= this.officialDistance && this.officialTimeLimits[this.officialDistance] !== undefined) {
        return this.officialTimeLimits[this.officialDistance];
      }
  
      return closingTime;
    }
  
    /**
     * Calculate minimum completion time (fastest allowed time)
     * 
     * @return Time in hours
     */
    public getMinimumCompletionTime(): number {
      return this.calculateOpeningTime(this.brevetDistance);
    }
  
    /**
     * Calculate maximum completion time (time limit)
     * 
     * @return Time in hours
     */
    public getMaximumCompletionTime(): number {
      // For standard brevets, use the official time limit
      if (this.officialTimeLimits[this.officialDistance] !== undefined) {
        return this.officialTimeLimits[this.officialDistance];
      }
  
      // For non-standard distances, calculate based on minimum speeds
      return this.calculateClosingTime(this.brevetDistance);
    }
  
    /**
     * Convert hours to a formatted time string (HH:MM)
     * 
     * @param hours Time in hours
     * @return Formatted time string
     */
    public formatTime(hours: number): string {
      const totalMinutes = Math.round(hours * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
  
      return `${h}H${m.toString().padStart(2, '0')}`;
    }
  
    /**
     * Get control opening datetime
     * 
     * @param controlDistance Distance of the control in kilometers
     * @return Opening datetime
     */
    public getOpeningDateTime(controlDistance: number): Date {
      const openingTime = this.calculateOpeningTime(controlDistance);
      const hours = Math.floor(openingTime);
      const minutes = Math.round((openingTime - hours) * 60);
  
      const datetime = new Date(this.startTime);
      datetime.setHours(datetime.getHours() + hours);
      datetime.setMinutes(datetime.getMinutes() + minutes);
  
      return datetime;
    }
  
    /**
     * Get control closing datetime
     * 
     * @param controlDistance Distance of the control in kilometers
     * @return Closing datetime
     */
    public getClosingDateTime(controlDistance: number): Date {
      const closingTime = this.calculateClosingTime(controlDistance);
      const hours = Math.floor(closingTime);
      const minutes = Math.round((closingTime - hours) * 60);
  
      const datetime = new Date(this.startTime);
      datetime.setHours(datetime.getHours() + hours);
      datetime.setMinutes(datetime.getMinutes() + minutes);
  
      return datetime;
    }
  
    /**
     * Get minimum completion datetime (earliest allowed finish)
     * 
     * @return Minimum completion datetime
     */
    public getMinimumCompletionDateTime(): Date {
      const minTime = this.getMinimumCompletionTime();
      const hours = Math.floor(minTime);
      const minutes = Math.round((minTime - hours) * 60);
  
      const datetime = new Date(this.startTime);
      datetime.setHours(datetime.getHours() + hours);
      datetime.setMinutes(datetime.getMinutes() + minutes);
  
      return datetime;
    }
  
    /**
     * Get maximum completion datetime (time limit)
     * 
     * @return Maximum completion datetime
     */
    public getMaximumCompletionDateTime(): Date {
      const maxTime = this.getMaximumCompletionTime();
      const hours = Math.floor(maxTime);
      const minutes = Math.round((maxTime - hours) * 60);
  
      const datetime = new Date(this.startTime);
      datetime.setHours(datetime.getHours() + hours);
      datetime.setMinutes(datetime.getMinutes() + minutes);
  
      return datetime;
    }
  
    /**
     * Get control times as formatted strings
     * 
     * @param controlDistance Distance of the control in kilometers
     * @return Object with opening and closing times
     */
    public getControlTimes(controlDistance: number): ControlTime {
      return {
        distance: controlDistance,
        openingHours: this.calculateOpeningTime(controlDistance),
        openingTime: this.formatTime(this.calculateOpeningTime(controlDistance)),
        openingDatetime: this.getOpeningDateTime(controlDistance),
        closingHours: this.calculateClosingTime(controlDistance),
        closingTime: this.formatTime(this.calculateClosingTime(controlDistance)),
        closingDatetime: this.getClosingDateTime(controlDistance)
      };
    }
  
    /**
     * Get brevets's overall time limits
     * 
     * @return Object with min and max completion times
     */
    public getBrevetTimeLimits(): BrevetTimeLimits {
      return {
        distance: this.brevetDistance,
        officialDistance: this.officialDistance,
        minHours: this.getMinimumCompletionTime(),
        minTime: this.formatTime(this.getMinimumCompletionTime()),
        minDatetime: this.getMinimumCompletionDateTime(),
        maxHours: this.getMaximumCompletionTime(),
        maxTime: this.formatTime(this.getMaximumCompletionTime()),
        maxDatetime: this.getMaximumCompletionDateTime()
      };
    }
  
    /**
     * Calculate control times for multiple controls
     * 
     * @param controlDistances Array of control distances
     * @return Array of control times
     */
    public calculateControls(controlDistances: number[]): ControlTime[] {
      const results: ControlTime[] = [];
      
      // First sort the control distances
      const sortedDistances = [...controlDistances].sort((a, b) => a - b);
      
      sortedDistances.forEach((distance, index) => {
        const controlTime = this.getControlTimes(distance);
        
        // Special rule: Start control (0 km) should be open for exactly one hour
        if (distance === 0) {
          const openingTime = new Date(controlTime.openingDatetime);
          
          // Set closing time to exactly one hour after opening time
          const newClosingTime = new Date(openingTime);
          newClosingTime.setHours(newClosingTime.getHours() + 1);
          
          // Update control time with new closing time
          controlTime.closingDatetime = newClosingTime;
          controlTime.closingHours = controlTime.openingHours + 1;
          controlTime.closingTime = this.formatTime(controlTime.closingHours);
        }
        
        results.push(controlTime);
      });
      
      return results;
    }
  }