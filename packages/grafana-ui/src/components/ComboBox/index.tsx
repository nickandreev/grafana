import { css } from '@emotion/css';
import { useFloating, flip, shift, autoUpdate } from '@floating-ui/react';
import { useCombobox } from 'downshift';
import React, { useMemo } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

const ROW_HEIGHT = 30;
const LIST_MAX_HEIGHT = 300;

interface ComboBoxItem {
  value: string;
  label: string;
}

interface ComboBoxProps {
  options?: ComboBoxItem[];
  value?: string;
  onChange?(value: string | undefined): void;
  labelId: string;
  inputId: string;
}

interface VirtualData {
  items: ComboBoxItem[];
  highlightedIndex: number;
  getItemProps: any; // JOSH TODO
  selectedItem: ComboBoxItem | undefined;
}

export function ComboBox({ value, onChange, options, labelId, inputId }: ComboBoxProps) {
  const styles = useStyles2(getStyles);
  const [inputValue, setInputValue] = React.useState('');

  const filteredOptions = useMemo(() => {
    if (!inputValue) {
      return options ?? [];
    }

    const phraseLowerCase = inputValue.toLowerCase();
    console.time('Combobox filtering');
    const filtered = (options ?? []).filter((v) => v.label.toLowerCase().includes(phraseLowerCase));
    console.timeEnd('Combobox filtering');

    return filtered;
  }, [options, inputValue]);

  const selectedItem = useMemo(() => {
    console.log('combobox value is', value);
    console.time('combobox find selectedItem');
    const selected = (options ?? []).find((v) => v.value === value);
    console.timeEnd('combobox find selectedItem');
    return selected;
  }, [options, value]);

  console.log('combobox selectedItem is', selectedItem);

  let { isOpen, getToggleButtonProps, getMenuProps, getInputProps, highlightedIndex, getItemProps } = useCombobox({
    labelId,
    inputId,

    items: filteredOptions,
    itemToString(item) {
      return item ? item.label : '';
    },

    selectedItem,
    onSelectedItemChange: ({ selectedItem }) => {
      onChange && onChange(selectedItem?.value);
    },

    onInputValueChange({ inputValue }) {
      setInputValue(inputValue ?? '');
    },
  });

  const { refs, floatingStyles } = useFloating({
    placement: 'bottom',
    open: isOpen,
    middleware: [flip(), shift()],
    whileElementsMounted: autoUpdate,
  });

  const menuProps = getMenuProps({
    ref: refs.setFloating,
  });
  // const menuRef = useMergeRefs([refs.setFloating, downshiftMenuRef]);

  // JOSH TODO: less hard coding? Can we AutoSizer this?
  const listHeight = Math.min(LIST_MAX_HEIGHT, filteredOptions.length * ROW_HEIGHT);

  const virtualData = useMemo(() => {
    return {
      highlightedIndex,
      getItemProps,
      selectedItem,
      items: filteredOptions,
    };
  }, [highlightedIndex, getItemProps, selectedItem, filteredOptions]);

  // JOSH TODO: still getting `the ref prop "ref" from getMenuProps was not applied correctly on your element.`

  return (
    <div>
      <div className={styles.inputBox} ref={refs.setReference}>
        <input placeholder="Best book ever" {...getInputProps()} />

        <button aria-label="toggle menu" type="button" {...getToggleButtonProps()}>
          {isOpen ? <>&#8593;</> : <>&#8595;</>}
        </button>
      </div>

      {isOpen && (
        <ul {...menuProps} className={styles.floatingList} style={{ ...floatingStyles, height: listHeight }}>
          <FixedSizeList
            className={styles.virtualList}
            height={listHeight}
            width={200} // JOSH TODO: don't hardcode width
            itemSize={ROW_HEIGHT}
            itemCount={filteredOptions.length}
            itemData={virtualData}
          >
            {Row}
          </FixedSizeList>
        </ul>
      )}
    </div>
  );
}

function Row({ index, data, style }: ListChildComponentProps<VirtualData>) {
  const styles = useStyles2(getStyles);
  const { items, highlightedIndex, getItemProps, selectedItem } = data;
  const item = items[index];

  return (
    <div
      {...getItemProps({
        index,
        item,
      })}
      className={styles.row}
      style={{
        ...style,
        outline: highlightedIndex === index ? '2px solid blue' : 'none',
        fontWeight: selectedItem === item ? 'bold' : 'normal',
      }}
    >
      {item.label} / {item.value}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    inputBox: css({
      display: 'inline-block',
      background: theme.colors.background.primary,
    }),
    floatingList: css({
      background: theme.colors.background.secondary,
      // width: 'max-content',
      position: 'absolute',
      top: 0,
      left: 0,
      height: 300,
      width: 200,
      overflow: 'none',
    }),
    virtualList: css({}),
    row: css({
      height: ROW_HEIGHT,
    }),
  };
}
