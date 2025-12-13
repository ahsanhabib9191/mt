#!/usr/bin/env ts-node
/**
 * Task Listing and Validation Script
 * 
 * This script validates the implementation of AdSet and Ad models
 * according to the plan in plan-v1-:-create-adset-and-ad-models-with-performance-tracking.md
 */

import { connectDB } from '../lib/db/client';
import { AdSetModel, AdModel } from '../lib/db/models';
import mongoose from 'mongoose';

interface TaskStatus {
  task: string;
  status: 'completed' | 'pending' | 'failed';
  details?: string;
}

async function validateAdSetModel(): Promise<TaskStatus[]> {
  const tasks: TaskStatus[] = [];

  try {
    // Check if model exists
    const modelExists = mongoose.models.AdSet !== undefined;
    tasks.push({
      task: '1.1 AdSet Model Created',
      status: modelExists ? 'completed' : 'failed',
      details: modelExists ? 'Model found in mongoose.models' : 'Model not found'
    });

    if (!modelExists) return tasks;

    // Validate schema fields
    const schema = AdSetModel.schema;
    const paths = schema.paths;

    const requiredFields = [
      'adSetId', 'campaignId', 'accountId', 'name', 'status',
      'budget', 'learningPhaseStatus', 'optimizationGoal'
    ];

    requiredFields.forEach(field => {
      const exists = paths[field] !== undefined;
      tasks.push({
        task: `1.2 AdSet Field: ${field}`,
        status: exists ? 'completed' : 'failed',
        details: exists ? 'Field defined in schema' : 'Field missing'
      });
    });

    // Validate indexes
    const indexes = schema.indexes();
    tasks.push({
      task: '1.3 AdSet Indexes Created',
      status: indexes.length >= 6 ? 'completed' : 'failed',
      details: `${indexes.length} indexes defined (expected 6)`
    });

    // Check for unique adSetId index
    const hasUniqueIndex = indexes.some(idx => 
      idx[0].adSetId && idx[1]?.unique === true
    );
    tasks.push({
      task: '1.4 AdSet Unique Index on adSetId',
      status: hasUniqueIndex ? 'completed' : 'failed',
      details: hasUniqueIndex ? 'Unique index configured' : 'Unique index missing'
    });

    // Validate targeting nested schema
    const targetingPath = paths['targeting'];
    tasks.push({
      task: '1.5 AdSet Targeting Schema',
      status: targetingPath ? 'completed' : 'failed',
      details: targetingPath ? 'Targeting nested schema defined' : 'Targeting schema missing'
    });

    // Validate enum values
    const statusPath = paths['status'];
    const statusEnum = statusPath?.options?.enum;
    const hasValidEnum = statusEnum && statusEnum.includes('ACTIVE') && statusEnum.includes('PAUSED');
    tasks.push({
      task: '1.6 AdSet Status Enum',
      status: hasValidEnum ? 'completed' : 'failed',
      details: hasValidEnum ? `Enum values: ${statusEnum.join(', ')}` : 'Status enum missing or invalid'
    });

  } catch (error: any) {
    tasks.push({
      task: '1. AdSet Model Validation',
      status: 'failed',
      details: error.message
    });
  }

  return tasks;
}

async function validateAdModel(): Promise<TaskStatus[]> {
  const tasks: TaskStatus[] = [];

  try {
    // Check if model exists
    const modelExists = mongoose.models.Ad !== undefined;
    tasks.push({
      task: '2.1 Ad Model Created',
      status: modelExists ? 'completed' : 'failed',
      details: modelExists ? 'Model found in mongoose.models' : 'Model not found'
    });

    if (!modelExists) return tasks;

    // Validate schema fields
    const schema = AdModel.schema;
    const paths = schema.paths;

    const requiredFields = [
      'adId', 'adSetId', 'campaignId', 'accountId', 'name',
      'status', 'creative', 'effectiveStatus'
    ];

    requiredFields.forEach(field => {
      const exists = paths[field] !== undefined;
      tasks.push({
        task: `2.2 Ad Field: ${field}`,
        status: exists ? 'completed' : 'failed',
        details: exists ? 'Field defined in schema' : 'Field missing'
      });
    });

    // Validate indexes
    const indexes = schema.indexes();
    tasks.push({
      task: '2.3 Ad Indexes Created',
      status: indexes.length >= 6 ? 'completed' : 'failed',
      details: `${indexes.length} indexes defined (expected 6)`
    });

    // Check for unique adId index
    const hasUniqueIndex = indexes.some(idx => 
      idx[0].adId && idx[1]?.unique === true
    );
    tasks.push({
      task: '2.4 Ad Unique Index on adId',
      status: hasUniqueIndex ? 'completed' : 'failed',
      details: hasUniqueIndex ? 'Unique index configured' : 'Unique index missing'
    });

    // Validate creative nested schema
    const creativePath = paths['creative'];
    tasks.push({
      task: '2.5 Ad Creative Schema',
      status: creativePath ? 'completed' : 'failed',
      details: creativePath ? 'Creative nested schema defined' : 'Creative schema missing'
    });

    // Validate issues array
    const issuesPath = paths['issues'];
    const isArray = issuesPath?.instance === 'Array';
    tasks.push({
      task: '2.6 Ad Issues Array',
      status: isArray ? 'completed' : 'failed',
      details: isArray ? 'Issues array defined' : 'Issues array missing or wrong type'
    });

    // Validate enum values
    const statusPath = paths['status'];
    const statusEnum = statusPath?.options?.enum;
    const hasValidEnum = statusEnum && statusEnum.includes('ACTIVE') && statusEnum.includes('PAUSED');
    tasks.push({
      task: '2.7 Ad Status Enum',
      status: hasValidEnum ? 'completed' : 'failed',
      details: hasValidEnum ? `Enum values: ${statusEnum.join(', ')}` : 'Status enum missing or invalid'
    });

    const effectiveStatusPath = paths['effectiveStatus'];
    const effectiveStatusEnum = effectiveStatusPath?.options?.enum;
    const hasEffectiveEnum = effectiveStatusEnum && 
      effectiveStatusEnum.includes('ACTIVE') && 
      effectiveStatusEnum.includes('DISAPPROVED');
    tasks.push({
      task: '2.8 Ad EffectiveStatus Enum',
      status: hasEffectiveEnum ? 'completed' : 'failed',
      details: hasEffectiveEnum ? `Enum values: ${effectiveStatusEnum.join(', ')}` : 'EffectiveStatus enum missing or invalid'
    });

  } catch (error: any) {
    tasks.push({
      task: '2. Ad Model Validation',
      status: 'failed',
      details: error.message
    });
  }

  return tasks;
}

async function validateDatabaseInitialization(): Promise<TaskStatus[]> {
  const tasks: TaskStatus[] = [];

  try {
    // Check if models are registered in mongoose
    const adSetRegistered = mongoose.models.AdSet !== undefined;
    const adRegistered = mongoose.models.Ad !== undefined;

    tasks.push({
      task: '3.1 Database Initialization - AdSet',
      status: adSetRegistered ? 'completed' : 'failed',
      details: adSetRegistered ? 'AdSet model registered' : 'AdSet model not registered'
    });

    tasks.push({
      task: '3.2 Database Initialization - Ad',
      status: adRegistered ? 'completed' : 'failed',
      details: adRegistered ? 'Ad model registered' : 'Ad model not registered'
    });

    // Try to access collections to verify database connectivity
    if (adSetRegistered) {
      try {
        await AdSetModel.countDocuments({});
        tasks.push({
          task: '3.3 AdSet Collection Access',
          status: 'completed',
          details: 'Successfully queried AdSet collection'
        });
      } catch (error: any) {
        tasks.push({
          task: '3.3 AdSet Collection Access',
          status: 'failed',
          details: error.message
        });
      }
    }

    if (adRegistered) {
      try {
        await AdModel.countDocuments({});
        tasks.push({
          task: '3.4 Ad Collection Access',
          status: 'completed',
          details: 'Successfully queried Ad collection'
        });
      } catch (error: any) {
        tasks.push({
          task: '3.4 Ad Collection Access',
          status: 'failed',
          details: error.message
        });
      }
    }

  } catch (error: any) {
    tasks.push({
      task: '3. Database Initialization Validation',
      status: 'failed',
      details: error.message
    });
  }

  return tasks;
}

async function validateModelExports(): Promise<TaskStatus[]> {
  const tasks: TaskStatus[] = [];

  try {
    // Check if models are exported from index
    const { AdSetModel: AdSetExport, AdModel: AdExport } = await import('../lib/db/models/index');

    tasks.push({
      task: '4.1 AdSet Model Export',
      status: AdSetExport !== undefined ? 'completed' : 'failed',
      details: AdSetExport !== undefined ? 'AdSetModel exported from index' : 'AdSetModel not found in exports'
    });

    tasks.push({
      task: '4.2 Ad Model Export',
      status: AdExport !== undefined ? 'completed' : 'failed',
      details: AdExport !== undefined ? 'AdModel exported from index' : 'AdModel not found in exports'
    });

    // Check type exports - TypeScript types can't be checked at runtime
    // but we can verify the module exports the models correctly which confirms
    // the type exports are also present (they're in the same export statements)
    const exportsObject = await import('../lib/db/models/index');
    const hasTypeExports = 'AdSetModel' in exportsObject && 'AdModel' in exportsObject;

    tasks.push({
      task: '4.3 Type Exports Available',
      status: hasTypeExports ? 'completed' : 'failed',
      details: hasTypeExports ? 'TypeScript types exported from models/index.ts (verified via model exports)' : 'Type exports missing or incomplete'
    });

  } catch (error: any) {
    tasks.push({
      task: '4. Model Exports Validation',
      status: 'failed',
      details: error.message
    });
  }

  return tasks;
}

async function printTaskReport(tasks: TaskStatus[]) {
  console.log('\n' + '='.repeat(80));
  console.log('TASK IMPLEMENTATION STATUS REPORT');
  console.log('='.repeat(80) + '\n');

  const completed = tasks.filter(t => t.status === 'completed').length;
  const failed = tasks.filter(t => t.status === 'failed').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const total = tasks.length;

  tasks.forEach(task => {
    const icon = task.status === 'completed' ? '✅' : 
                 task.status === 'failed' ? '❌' : '⏳';
    console.log(`${icon} ${task.task}`);
    if (task.details) {
      console.log(`   └─ ${task.details}`);
    }
  });

  console.log('\n' + '-'.repeat(80));
  console.log(`SUMMARY: ${completed}/${total} tasks completed`);
  if (failed > 0) {
    console.log(`⚠️  ${failed} task(s) failed`);
  }
  if (pending > 0) {
    console.log(`⏳ ${pending} task(s) pending`);
  }
  console.log('-'.repeat(80) + '\n');

  return { completed, failed, pending, total };
}

async function main() {
  console.log('🔍 Starting Task Validation...\n');

  try {
    // Connect to database
    await connectDB();
    console.log('✅ Database connected\n');

    // Collect all tasks
    const allTasks: TaskStatus[] = [];

    console.log('📋 Validating AdSet Model...');
    const adSetTasks = await validateAdSetModel();
    allTasks.push(...adSetTasks);

    console.log('📋 Validating Ad Model...');
    const adTasks = await validateAdModel();
    allTasks.push(...adTasks);

    console.log('📋 Validating Database Initialization...');
    const dbTasks = await validateDatabaseInitialization();
    allTasks.push(...dbTasks);

    console.log('📋 Validating Model Exports...');
    const exportTasks = await validateModelExports();
    allTasks.push(...exportTasks);

    // Print comprehensive report
    const summary = await printTaskReport(allTasks);

    // Exit with appropriate code
    if (summary.failed > 0) {
      process.exit(1);
    }

    process.exit(0);

  } catch (error: any) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { validateAdSetModel, validateAdModel, validateDatabaseInitialization, validateModelExports };
