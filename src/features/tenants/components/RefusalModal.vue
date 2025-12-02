<script setup lang="ts">
import { ref, watch, defineProps, defineEmits } from 'vue';
import Modal from '@/shared/components/Modal.vue';
import Button from '@/shared/components/Button.vue';

const props = defineProps<{
  modelValue: boolean;
  defaultEmailMessage: string | null;
  tenantEmail?: string | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [boolean];
  cancel: [];
  confirm: [{ reason?: string | undefined; emailMessage?: string | undefined }];
}>();

const reason = ref<string>('');
const emailMessage = ref<string>('');

// When modal opens, initialize fields. Also react if defaultEmailMessage changes while open.
watch(
  () => props.modelValue,
  v => {
    if (v) {
      reason.value = '';
      emailMessage.value = props.defaultEmailMessage || '';
      console.log('[RefusalModal] opened with defaultEmailMessage:', props.defaultEmailMessage);
    }
  }
);

watch(
  () => props.defaultEmailMessage,
  v => {
    if (props.modelValue) {
      emailMessage.value = v || '';
    }
  }
);

function close() {
  emit('update:modelValue', false);
  emit('cancel');
}

function confirm() {
  emit('confirm', {
    reason: reason.value || undefined,
    emailMessage: emailMessage.value || undefined,
  });
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :modelValue="modelValue"
    title="Refuser la candidature"
    size="md"
    @update:modelValue="$emit('update:modelValue', $event)"
  >
    <div>
      <p>Veuillez indiquer la raison du refus (sera enregistrée dans l'historique).</p>
      <textarea
        v-model="reason"
        rows="3"
        style="width: 100%; margin-top: 8px"
        placeholder="Motif du refus (facultatif)"
      ></textarea>

      <hr style="margin: 16px 0" />

      <p>Message proposé pour l'email au locataire (modifiable).</p>
      <textarea v-model="emailMessage" rows="6" style="width: 100%; margin-top: 8px"></textarea>

      <div style="margin-top: 12px; color: var(--text-secondary, #64748b); font-size: 0.9rem">
        <p v-if="tenantEmail">
          Cet email sera envoyé à : <strong>{{ tenantEmail }}</strong>
        </p>
        <p v-else>Pas d'adresse email renseignée pour ce locataire.</p>
      </div>
    </div>

    <template #footer>
      <Button variant="ghost" @click="close">Annuler</Button>
      <Button variant="error" @click="confirm">Refuser et proposer l'email</Button>
    </template>
  </Modal>
</template>

<style scoped>
/* Use app spacing and input styles */
.modal-body p {
  margin: 0 0 8px 0;
}

textarea {
  font-family: inherit;
  padding: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-md, 0.5rem);
  background: var(--color-surface, #fff);
  box-shadow: var(--shadow-sm, none);
}

.modal-footer {
  display: flex;
  gap: 12px;
}
</style>
