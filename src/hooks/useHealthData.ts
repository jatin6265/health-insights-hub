import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

interface HealthDataSource {
  name: string;
  status: 'inactive' | 'active' | 'syncing' | 'error';
  lastSync: string;
  permission: boolean;
}

export const useHealthData = () => {
  const [dataSources, setDataSources] = useState<HealthDataSource[]>([
    { name: "Sleep Data", status: "inactive", lastSync: "Not connected", permission: false },
    { name: "Physical Activity", status: "inactive", lastSync: "Not connected", permission: false },
    { name: "Screen Time", status: "inactive", lastSync: "Not connected", permission: false },
    { name: "Heart Rate", status: "inactive", lastSync: "Not connected", permission: false },
  ]);

  const requestHealthPermissions = useCallback(async () => {
    const platform = Capacitor.getPlatform();
    
    if (platform === 'web') {
      toast.error('Health data access requires a mobile device', {
        description: 'Please install the app on iOS or Android'
      });
      return false;
    }

    try {
      // This is where we'll integrate with HealthKit (iOS) or Health Connect (Android)
      // For now, we'll simulate the permission flow
      
      toast.info('Requesting health permissions...', {
        description: 'Please grant access in your device settings'
      });

      // Simulate permission request
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Update all data sources to active
      setDataSources(prev => prev.map(source => ({
        ...source,
        status: 'active',
        lastSync: 'Just now',
        permission: true
      })));

      toast.success('Health data connected!', {
        description: 'Your health data is now being monitored'
      });

      return true;
    } catch (error) {
      console.error('Permission error:', error);
      toast.error('Failed to connect health data', {
        description: 'Please check your device settings'
      });
      return false;
    }
  }, []);

  const fetchSleepData = useCallback(async (days: number = 7) => {
    const platform = Capacitor.getPlatform();
    
    if (platform === 'web') {
      // Return mock data for web testing
      return {
        averageHours: 6.5,
        nights: days,
        quality: 'moderate'
      };
    }

    try {
      // This is where we'll fetch real sleep data from HealthKit/Health Connect
      // For now, return mock data
      return {
        averageHours: 6.5,
        nights: days,
        quality: 'moderate'
      };
    } catch (error) {
      console.error('Fetch sleep data error:', error);
      throw error;
    }
  }, []);

  const syncDataSource = useCallback(async (sourceName: string) => {
    setDataSources(prev => prev.map(source => 
      source.name === sourceName 
        ? { ...source, status: 'syncing' }
        : source
    ));

    // Simulate sync
    await new Promise(resolve => setTimeout(resolve, 1000));

    setDataSources(prev => prev.map(source => 
      source.name === sourceName 
        ? { ...source, status: 'active', lastSync: 'Just now' }
        : source
    ));
  }, []);

  return {
    dataSources,
    requestHealthPermissions,
    fetchSleepData,
    syncDataSource,
  };
};
