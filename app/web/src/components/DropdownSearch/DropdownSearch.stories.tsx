import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { DropdownSearch } from '.';
import type { DropdownSelection } from '../../state/dropdown-store';

const meta: Meta<typeof DropdownSearch> = {
  title: 'Components/DropdownSearch',
  component: DropdownSearch,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof DropdownSearch>;

export const Default: Story = {
  render: () => {
    const [selections, setSelections] = useState<DropdownSelection[]>([]);

    return (
      <div style={{ padding: '2rem' }}>
        <DropdownSearch onSelectionsChange={setSelections} />
        <pre style={{ marginTop: '1.5rem' }}>{JSON.stringify(selections, null, 2)}</pre>
      </div>
    );
  },
};
